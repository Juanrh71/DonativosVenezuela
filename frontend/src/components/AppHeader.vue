<template>
  <header class="site-header">
    <div class="flag-bar">
      <span class="flag-stripe yellow"></span>
      <span class="flag-stripe blue"></span>
      <span class="flag-stripe red"></span>
    </div>
    <div class="header-content">
      <div class="header-brand">
        <span class="flag-emoji" aria-hidden="true">🇻🇪</span>
        <div>
          <p class="header-slogan">Apoyemos todos a Venezuela, juntos somos más</p>
          <h1 class="header-title">Reporte de Insumos — Ayuda al Terremoto</h1>
        </div>
      </div>
      <nav class="main-nav" aria-label="Navegación principal">
        <RouterLink to="/registrar" class="nav-link">Registrar</RouterLink>
        <RouterLink to="/reportes" class="nav-link">Reportes</RouterLink>
        <RouterLink to="/mapa" class="nav-link">Mapa en vivo</RouterLink>
        <RouterLink to="/dashboard" class="nav-link">Dashboard</RouterLink>
      </nav>
    </div>
    <div class="flag-bar">
      <span class="flag-stripe yellow"></span>
      <span class="flag-stripe blue"></span>
      <span class="flag-stripe red"></span>
    </div>
  </header>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>
