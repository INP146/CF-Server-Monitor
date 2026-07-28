<template>
  <main class="login-page" :class="{ 'is-dark': isDark }">
    <AppHeader subtitle="ADMIN LOGIN" :is-dark="isDark" @toggle-theme="$emit('toggle-theme')">
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
            <a-select v-model:value="formState.apiEndpoint" size="large">
              <a-select-option v-for="endpoint in apiEndpoints" :key="endpoint.value" :value="endpoint.value">
                {{ endpoint.label }} · {{ endpoint.value }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-alert v-if="loginError" type="error" show-icon :message="loginError" class="admin-feedback" />

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

          <div v-if="turnstileRequired && !turnstileVerified" id="admin-turnstile-container" class="login-options" />
          <a-alert v-else-if="turnstileVerified" type="success" show-icon message="安全验证已通过" class="login-options" />

          <a-button type="primary" size="large" html-type="submit" block :loading="submitting">
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
import { getApiBases } from '../utils/config'
import { http } from '../utils/http'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const submitting = ref(false)
const loginError = ref('')
const route = useRoute()
const router = useRouter()
const bases = getApiBases()
const apiEndpoints = bases.map((value, index) => ({ label: bases.length > 1 ? `站点 ${index + 1}` : '当前站点', value }))
const formState = reactive({
  apiEndpoint: apiEndpoints[0]!.value,
  username: '',
  password: '',
})
const {
  turnstileEnabled,
  turnstileLoginEnabled,
  turnstileSiteKey,
  turnstileToken,
  turnstileVerified,
  loadTurnstileConfig,
  renderTurnstile,
  resetTurnstile,
  removeTurnstile,
  clearTurnstile,
} = useTurnstile()
const turnstileRequired = ref(false)

const rules: Record<string, Rule[]> = {
  apiEndpoint: [{ required: true, message: '请选择管理站点', trigger: 'change' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function submitLogin() {
  if (submitting.value) return
  loginError.value = ''
  if (turnstileRequired.value && !turnstileVerified.value && !turnstileToken.value) {
    loginError.value = '请先完成安全验证'
    return
  }
  submitting.value = true
  const apiIndex = Math.max(0, bases.indexOf(formState.apiEndpoint))
  if (turnstileEnabled.value && !turnstileVerified.value && turnstileToken.value) {
    const verification = await http.getByIndex<{ verified?: boolean }>('/api/config', apiIndex, {
      includeAuth: false,
      includeTurnstile: true,
      autoRedirect: false,
    })
    if (verification.error || verification.data?.verified !== true) {
      submitting.value = false
      loginError.value = '安全验证失败，请重试'
      clearTurnstile()
      resetTurnstile('#admin-turnstile-container')
      return
    }
  }
  const result = await login(formState.username, formState.password, turnstileToken.value, apiIndex)
  submitting.value = false
  if (result.error) {
    loginError.value = result.status === 403 ? '安全验证失败，请重试' : (result.message || '用户名或密码错误')
    formState.password = ''
    clearTurnstile()
    resetTurnstile('#admin-turnstile-container')
    return
  }
  clearTurnstile()
  await router.replace(String(route.query.redirect || '/admin/panel'))
}

async function setupTurnstile() {
  const apiIndex = Math.max(0, bases.indexOf(formState.apiEndpoint))
  await loadTurnstileConfig(apiIndex, bases.length > 1, loginError)
  turnstileRequired.value = turnstileEnabled.value || turnstileLoginEnabled.value
  if (turnstileRequired.value && !turnstileVerified.value && turnstileSiteKey.value) {
    await nextTick()
    renderTurnstile('#admin-turnstile-container', turnstileSiteKey.value)
  }
}

watch(() => formState.apiEndpoint, () => { void setupTurnstile() })
onMounted(() => { void setupTurnstile() })
onBeforeUnmount(() => removeTurnstile('#admin-turnstile-container'))
</script>
