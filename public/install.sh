#!/bin/sh
# ==============================================================================
# EdgeProbe Linux 统一安装入口
# 自动选择通用 Linux、Alpine、OpenWrt 或 Synology 的内部实现。
# ==============================================================================

set -u

error() {
    printf '[x] %s\n' "$1" >&2
    exit 1
}

detect_platform() {
    case "${EDGEPROBE_PLATFORM:-}" in
        linux|alpine|openwrt|synology)
            printf '%s' "$EDGEPROBE_PLATFORM"
            return
            ;;
        '') ;;
        *) error "不支持的平台覆盖值: $EDGEPROBE_PLATFORM" ;;
    esac

    if [ -f /etc/synoinfo.conf ] || command -v synopkg >/dev/null 2>&1; then
        printf 'synology'
    elif [ -f /etc/openwrt_release ] || [ -d /etc/uci-defaults ]; then
        printf 'openwrt'
    elif [ -f /etc/alpine-release ]; then
        printf 'alpine'
    else
        printf 'linux'
    fi
}

read_configured_worker_url() {
    for config_file in /etc/config/cf-probe/config.conf /usr/local/etc/cf-probe/config.conf; do
        [ -r "$config_file" ] || continue
        while IFS='=' read -r key value; do
            if [ "$key" = 'WORKER_URL' ]; then
                value=${value%\"}
                value=${value#\"}
                printf '%s' "$value"
                return
            fi
        done < "$config_file"
    done
}

origin_from_url() {
    source_url=${1%%\?*}
    case "$source_url" in
        http://*)
            source_rest=${source_url#http://}
            printf 'http://%s' "${source_rest%%/*}"
            ;;
        https://*)
            source_rest=${source_url#https://}
            printf 'https://%s' "${source_rest%%/*}"
            ;;
        *) return 1 ;;
    esac
}

platform=$(detect_platform)
source_base=''
worker_url=''

for arg in "$@"; do
    case "$arg" in
        -source=*|--source=*) source_base=${arg#*=} ;;
        -url=*) worker_url=${arg#-url=} ;;
    esac
done

if [ -z "$source_base" ]; then
    [ -n "$worker_url" ] || worker_url=$(read_configured_worker_url)
    if [ -n "$worker_url" ]; then
        source_base=$(origin_from_url "$worker_url") || source_base=''
    fi
fi

[ -n "$source_base" ] || error '无法确定脚本来源，请使用 -source=https://your-worker.example.com'
source_base=${source_base%/}
case "$source_base" in
    http://?*|https://?*) ;;
    *) error "脚本来源地址无效: $source_base" ;;
esac

case "$platform" in
    alpine)
        payload='install-alpine.sh'
        interpreter='sh'
        ;;
    openwrt)
        payload='install-openwrt.sh'
        interpreter='sh'
        ;;
    synology)
        payload='install-synology.sh'
        interpreter='bash'
        ;;
    linux)
        payload='install-linux.sh'
        interpreter='bash'
        ;;
esac

command -v curl >/dev/null 2>&1 || error '缺少 curl，无法下载平台安装脚本'
command -v "$interpreter" >/dev/null 2>&1 || error "当前平台需要 $interpreter，请先安装后重试"

umask 077
installer_tmp=$(mktemp "${TMPDIR:-/tmp}/edgeprobe-installer.XXXXXX") || error '无法创建临时文件'
trap 'rm -f "$installer_tmp"' 0 1 2 15

installer_url="${source_base}/${payload}"
printf '[->] 已检测平台: %s，加载 %s\n' "$platform" "$payload"
if ! curl -fsSL -o "$installer_tmp" "$installer_url"; then
    error "下载安装脚本失败: $installer_url"
fi

if "$interpreter" "$installer_tmp" "$@"; then
    installer_status=0
else
    installer_status=$?
fi
rm -f "$installer_tmp"
trap - 0 1 2 15
exit "$installer_status"
