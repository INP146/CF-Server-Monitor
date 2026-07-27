<template>
  <main class="login-page" :class="{ 'is-dark': isDark }">
    <div class="login-topbar">
      <a-button type="text" href="#/">
        <template #icon><ArrowLeftOutlined /></template>
        返回监控页
      </a-button>
      <a-tooltip :title="isDark ? '切换到浅色主题' : '切换到深色主题'">
        <a-button type="text" shape="circle" aria-label="切换主题" @click="$emit('toggle-theme')">
          <template #icon><BulbOutlined /></template>
        </a-button>
      </a-tooltip>
    </div>

    <section class="login-panel" aria-labelledby="login-title">
      <a-card class="login-card">
        <div class="login-heading">
          <h1 id="login-title">登录管理后台</h1>
          <p>使用管理员凭据继续</p>
        </div>

        <a-form
          :model="formState"
          :rules="rules"
          layout="vertical"
          required-mark="optional"
          @finish="submitLogin"
        >
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
            <a-checkbox v-model:checked="formState.remember">记住登录状态</a-checkbox>
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
import ATooltip from 'ant-design-vue/es/tooltip'
import {
  ArrowLeftOutlined,
  BulbOutlined,
  LockOutlined,
  LoginOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'

defineProps<{ isDark: boolean }>()
defineEmits<{ 'toggle-theme': [] }>()

const submitting = ref(false)
const formState = reactive({
  username: '',
  password: '',
  remember: true,
})

const rules: Record<string, Rule[]> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function submitLogin() {
  if (submitting.value) return
  submitting.value = true
  await new Promise((resolve) => window.setTimeout(resolve, 650))
  submitting.value = false
  window.location.hash = '#/'
}
</script>
