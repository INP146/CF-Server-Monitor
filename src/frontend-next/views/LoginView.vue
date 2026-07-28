<template>
  <main class="login-page" :class="{ 'is-dark': isDark }">
    <AppHeader :title="siteTitle" subtitle="ADMIN LOGIN" :is-dark="isDark" @toggle-theme="$emit('toggle-theme')">
      <a-button type="text" href="#/">
        <template #icon><ArrowLeftOutlined /></template>
        返回监控页
      </a-button>
    </AppHeader>

    <section class="login-panel" aria-labelledby="login-title">
      <a-card class="login-card">
        <div class="login-heading">
          <h1 id="login-title">登录管理后台</h1>
          <p>选择管理站点并输入管理员凭据</p>
        </div>

        <a-form
          :model="formState"
          :rules="rules"
          layout="vertical"
          required-mark="optional"
          @finish="submitLogin"
        >
          <a-form-item label="管理站点" name="apiEndpoint">
            <a-select v-model:value="formState.apiEndpoint" size="large" :disabled="submitting">
              <a-select-option v-for="endpoint in apiEndpoints" :key="endpoint.value" :value="endpoint.value">
                {{ endpoint.label }} · {{ endpoint.value }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-alert v-if="loginError" type="error" show-icon :message="loginError" class="admin-feedback">
            <template v-if="turnstileConfigFailed" #action>
              <a-button size="small" :loading="turnstileConfigLoading" @click="setupTurnstile">重试</a-button>
            </template>
          </a-alert>

          <a-form-item label="用户名" name="username">
            <a-input
              v-model:value="formState.username"
              size="large"
              name="username"
              autocomplete="username"
              placeholder="admin"
            >
              <template #prefix><UserOutlined /></template>
            </a-input>
          </a-form-item>

          <a-form-item label="密码" name="password">
            <a-input-password
              v-model:value="formState.password"
              size="large"
              name="password"
              autocomplete="current-password"
              placeholder="请输入密码"
            >
              <template #prefix><LockOutlined /></template>
            </a-input-password>
          </a-form-item>

          <div v-if="turnstileRequired" id="admin-turnstile-container" class="login-options" />

          <a-button
            type="primary"
            size="large"
            html-type="submit"
            block
            :loading="submitting || turnstileConfigLoading"
            :disabled="turnstileConfigFailed"
          >
            <template #icon><LoginOutlined /></template>
            登录
          </a-button>
        </a-form>
      </a-card>
    </section>
  </main>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AAlert from 'ant-design-vue/es/alert'
import AButton from 'ant-design-vue/es/button'
import ACard from 'ant-design-vue/es/card'
import AForm, { FormItem as AFormItem, type Rule } from 'ant-design-vue/es/form'
import AInput, { InputPassword as AInputPassword } from 'ant-design-vue/es/input'
import ASelect, { SelectOption as ASelectOption } from 'ant-design-vue/es/select'
import {
  ArrowLeftOutlined,
  LockOutlined,
  LoginOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import AppHeader from '../components/AppHeader.vue'
import { useTurnstile } from '../composables/useTurnstile'
import { login } from '../utils/api'
import { normalizeApiIndex } from '../utils/auth'
import { getApiBases } from '../utils/config'
import { getPostLoginTarget } from '../utils/routing'
import { requiresFreshLoginTurnstileToken } from '../utils/turnstile'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const submitting = ref(false)
const loginError = ref('')
const siteTitle = document.title || 'EdgeProbe'
const route = useRoute()
const router = useRouter()
const bases = getApiBases()
const apiEndpoints = bases.map((value, index) => ({ label: bases.length > 1 ? `站点 ${index + 1}` : '当前站点', value }))
const initialApiIndex = normalizeApiIndex(route.query.api ?? route.query.apiIndex)
const formState = reactive({
  apiEndpoint: apiEndpoints[initialApiIndex]?.value ?? apiEndpoints[0]!.value,
  username: '',
  password: '',
})
const {
  turnstileEnabled,
  turnstileLoginEnabled,
  turnstileSiteKey,
  turnstileToken,
  loadTurnstileConfig,
  renderTurnstile,
  resetTurnstile,
  removeTurnstile,
  clearTurnstile,
} = useTurnstile()
const turnstileRequired = ref(false)
const turnstileConfigLoading = ref(true)
const turnstileConfigFailed = ref(false)
let turnstileSetupRun = 0
let loginMounted = false

const rules: Record<string, Rule[]> = {
  apiEndpoint: [{ required: true, message: '请选择管理站点', trigger: 'change' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function submitLogin() {
  if (submitting.value) return
  loginError.value = ''
  if (turnstileRequired.value && !turnstileToken.value) {
    loginError.value = '请先完成安全验证'
    return
  }
  submitting.value = true
  const apiIndex = Math.max(0, bases.indexOf(formState.apiEndpoint))
  const result = await login(formState.username, formState.password, turnstileToken.value, apiIndex)
  submitting.value = false
  if (result.error) {
    loginError.value = result.status === 403
      ? '安全验证失败，请重试'
      : result.status === 401 ? '用户名或密码错误' : (result.message || result.error || '登录请求失败')
    formState.password = ''
    clearTurnstile()
    resetTurnstile('#admin-turnstile-container')
    return
  }
  clearTurnstile()
  await router.replace(getPostLoginTarget(route.query.redirect, apiIndex))
}

async function setupTurnstile() {
  const currentRun = ++turnstileSetupRun
  const apiIndex = Math.max(0, bases.indexOf(formState.apiEndpoint))
  turnstileConfigLoading.value = true
  turnstileConfigFailed.value = false
  try {
    const loaded = await loadTurnstileConfig(apiIndex, bases.length > 1, loginError)
    if (currentRun !== turnstileSetupRun) return
    turnstileRequired.value = requiresFreshLoginTurnstileToken(turnstileEnabled.value, turnstileLoginEnabled.value)
    if (!loaded) {
      turnstileConfigFailed.value = true
      return
    }
    if (turnstileRequired.value && !turnstileSiteKey.value) {
      loginError.value = '当前站点未配置 Turnstile Site Key'
      turnstileConfigFailed.value = true
      return
    }
    if (turnstileRequired.value) {
      await nextTick()
      if (currentRun !== turnstileSetupRun) return
      renderTurnstile('#admin-turnstile-container', turnstileSiteKey.value)
    }
  } finally {
    if (currentRun === turnstileSetupRun) turnstileConfigLoading.value = false
  }
}

watch(() => formState.apiEndpoint, async () => {
  const apiIndex = Math.max(0, bases.indexOf(formState.apiEndpoint))
  if (String(route.query.api ?? '') !== String(apiIndex)) {
    await router.replace({ name: 'login', query: { ...route.query, api: String(apiIndex) } })
  }
  if (loginMounted) await setupTurnstile()
})
onMounted(() => { loginMounted = true; void setupTurnstile() })
onBeforeUnmount(() => {
  loginMounted = false
  turnstileSetupRun += 1
  removeTurnstile('#admin-turnstile-container')
})
</script>
