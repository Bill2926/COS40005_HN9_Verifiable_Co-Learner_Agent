<script setup lang="ts">
import { videoEmbed } from '#shared/materials'

const props = defineProps<{
  url: string
  title: string
}>()

const embed = computed(() => videoEmbed(props.url))
</script>

<template>
  <figure class="flex min-w-0 max-w-full flex-col gap-2">
    <iframe
      v-if="embed"
      :src="embed.src"
      :title="title"
      class="aspect-video w-full max-w-full rounded-[8px] border border-ink-200"
      loading="lazy"
      allow="fullscreen; picture-in-picture"
      allowfullscreen
    />
    <a
      v-else
      :href="url"
      class="min-w-0 text-sm font-medium break-words text-brand-700 underline"
      target="_blank"
      rel="noopener noreferrer"
    >{{ title }}</a>
    <figcaption v-if="embed" class="text-xs text-ink-500">{{ title }}</figcaption>
  </figure>
</template>
