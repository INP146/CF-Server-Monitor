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

          <div class="login-options">
            <a-checkbox v-model:checked="formState.turnstileVerified">安全验证已通过</a-checkbox>
          </div>

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
import { reactive, ref } from 'vue'
import AButton from 'ant-design-vue/es/button'
import ACard from 'ant-design-vue/es/card'
import ACheckbox from 'ant-design-vue/es/checkbox'
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
import { apiEndpoints } from '../data/admin'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const submitting = ref(false)
const formState = reactive({
  apiEndpoint: apiEndpoints[0]!.value,
  username: '',
  password: '',
  turnstileVerified: true,
})

const rules: Record<string, Rule[]> = {
  apiEndpoint: [{ required: true, message: '请选择管理站点', trigger: 'change' }],
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function submitLogin() {
  if (submitting.value) return
  submitting.value = true
  await new Promise((resolve) => window.setTimeout(resolve, 650))
  submitting.value = false
  window.sessionStorage.setItem('edgeprobe-admin', 'true')
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  window.location.hash = `#${params.get('redirect') || '/admin/panel'}`
}
</script>
