(() => {
  'use strict'
  let pipeline = Promise.resolve(), current = null, generation = 0
  const status = message => { const el = document.querySelector('[data-activity-status]'); if (el) el.textContent = message }
  const stop = async () => { if (current) { const old = current; current = null; await old.stop() } }
  window.RVLessonActivity = {
    detach() { generation++; pipeline = pipeline.then(stop).catch(() => {}) },
    mount(video, day) {
      if (!window.RVApi?.platformMode || !Number.isInteger(day) || day < 1 || day > 30) return
      const ticket = ++generation
      pipeline = pipeline.then(async () => {
        await stop()
        if (ticket !== generation) return
        status('Preparando o registro da aula…')
        const opened = await window.RVApi.request('/api/courses/rv30/activity/open', { method: 'POST', body: { day } })
        if (!opened.ok) { status(opened.message); return }
        let sequence = 0, queue = Promise.resolve(), stopped = false
        const send = event => {
          const input = { sessionId: opened.sessionId, event, positionSeconds: Number.isFinite(video.currentTime) ? video.currentTime : 0, visible: document.visibilityState === 'visible', playing: !video.paused && !video.ended }
          queue = queue.then(async () => {
            const result = await window.RVApi.request('/api/courses/rv30/activity/event', { method: 'POST', body: { ...input, sequence: ++sequence } })
            if (!result.ok) status('O vídeo continua disponível, mas não foi possível registrar este intervalo de atividade. Reabra a aula para sincronizar.')
            else status('Progresso de reprodução salvo no servidor. O tempo considera apenas atividade em uma página visível.')
          })
          return queue
        }
        if (ticket !== generation) { await send('close'); return }
        const restore = () => {
          if (opened.positionSeconds > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(opened.positionSeconds, Math.max(0, video.duration - 1))
        }
        if (video.readyState >= 1) restore(); else video.addEventListener('loadedmetadata', restore, { once: true })
        const handlers = { play: () => send('play'), pause: () => send('pause'), seeked: () => send('seek') }
        for (const [event, handler] of Object.entries(handlers)) video.addEventListener(event, handler)
        const visible = () => send('visibility')
        document.addEventListener('visibilitychange', visible)
        const timer = setInterval(() => { if (!video.paused && !video.ended && document.visibilityState === 'visible') send('heartbeat') }, 15000)
        current = { async stop() {
          if (stopped) return; stopped = true; clearInterval(timer)
          for (const [event, handler] of Object.entries(handlers)) video.removeEventListener(event, handler)
          video.removeEventListener('loadedmetadata', restore); document.removeEventListener('visibilitychange', visible)
          await send('close')
        } }
        status('Aula aberta. Sua posição será salva durante a reprodução.')
        if (!video.paused) await send('play')
      }).catch(() => { status('O registro de atividade está temporariamente indisponível.') })
    }
  }
  window.addEventListener('pagehide', () => window.RVLessonActivity.detach())
})()
