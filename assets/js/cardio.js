(() => {
  'use strict'
  // Formula de Karvonen, apenas para referencia educativa (nao diagnostico).
  const LEVELS = Object.freeze({
    sedentario: { low: 0.50, high: 0.70 },
    treinado: { low: 0.60, high: 0.80 },
    atleta: { low: 0.65, high: 0.85 }
  })
  const PREFIX = 'rv30-cardio-demo-v1:'
  const parse = (x) => x === '' || x == null ? NaN : Number(x)
  function calculate(data) {
    const age = parse(data?.age), resting = parse(data?.resting)
    const level = String(data?.level || '')
    if (!Number.isInteger(age) || age < 18 || age > 100) throw new RangeError('Informe idade entre 18 e 100 anos.')
    if (!Number.isInteger(resting) || resting < 35 || resting > 125) throw new RangeError('Confira sua FC de repouso (35 a 125 bpm).')
    if (!Object.hasOwn(LEVELS, level)) throw new RangeError('Escolha seu nivel de condicionamento.')
    const measured = !(data.maxMeasured == null || data.maxMeasured === '')
    const max = measured ? parse(data.maxMeasured) : 220 - age
    if (!Number.isInteger(max) || max < 90 || max > 240 || max <= resting + 10) {
      throw new RangeError('A FC maxima deve ser valida e maior que a FC de repouso.')
    }
    const { low, high } = LEVELS[level]
    return Object.freeze({
      age, resting, max, measured, level,
      lowPct: Math.round(low * 100), highPct: Math.round(high * 100),
      lower: Math.round((max - resting) * low + resting),
      upper: Math.round((max - resting) * high + resting)
    })
  }
  function compare(value, limits) {
    const n = parse(value)
    if (!Number.isInteger(n) || n < 30 || n > 250) throw new RangeError('Informe uma FC atual medida entre 30 e 250 bpm.')
    if (!limits) throw new RangeError('Calcule primeiro a faixa de treino.')
    return n < limits.lower ? 'abaixo' : n > limits.upper ? 'acima' : 'dentro'
  }
  function mount({ account, demoMode } = {}) {
    const root = document.querySelector('[data-cardio-section]')
    if (!root) return
    const $ = (s) => root.querySelector(s)
    const form = $('[data-cardio-form]'), output = $('[data-cardio-results]')
    const limits = $('[data-cardio-limits]'), info = $('[data-cardio-source]')
    const status = $('[data-cardio-feedback]'), reading = $('[data-cardio-current]')
    const interpretation = $('[data-cardio-comparison]'), save = $('[data-cardio-save]')
    const remove = $('[data-cardio-delete]')
    const host = window.location.hostname
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)
    const canSave = Boolean(local && !demoMode && account?.id && window.RV_COURSE_CONFIG?.testMode)
    const key = canSave ? PREFIX + account.id : null
    let calculated = null
    save.closest('label').hidden = !canSave
    save.disabled = !canSave
    remove.hidden = !canSave

    const show = (result) => {
      calculated = result
      output.hidden = false
      limits.textContent = result.lower + ' a ' + result.upper + ' bpm (' + result.lowPct + '% a ' + result.highPct + '% da FC de reserva)'
      info.textContent = result.measured
        ? 'FC maxima informada pelo usuario; a interpretacao depende de como foi obtida.'
        : 'FC maxima estimada: ' + result.max + ' bpm (220 - idade). Esse metodo pode apresentar erro significativo.'
      interpretation.textContent = 'Compare com uma leitura real de monitor cardiaco. O site nao mede sua FC automaticamente.'
      reading.value = ''
    }
    if (key) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null')
        if (value?.version === 1 && value.userId === account.id) {
          for (const name of ['age', 'resting', 'maxMeasured', 'level']) form.elements[name].value = value.profile[name] ?? ''
          save.checked = true
          show(calculate(value.profile))
        }
      } catch { /* perfil invalido nao impede uso */ }
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      status.textContent = ''
      const profile = {
        age: form.elements.age.value,
        resting: form.elements.resting.value,
        maxMeasured: form.elements.maxMeasured.value,
        level: form.elements.level.value
      }
      try {
        const result = calculate(profile)
        show(result)
        root.dispatchEvent(new CustomEvent('rv30:cardio-calculated', { bubbles: true }))
        if (key && save.checked) {
          localStorage.setItem(key, JSON.stringify({
            version: 1, userId: account.id,
            profile: { age: result.age, resting: result.resting, maxMeasured: result.measured ? result.max : '', level: result.level }
          }))
          status.textContent = 'Faixa calculada. Perfil salvo somente neste navegador de teste.'
        } else {
          if (key) localStorage.removeItem(key)
          status.textContent = 'Faixa calculada sem salvar seus dados.'
        }
      } catch (error) {
        calculated = null
        output.hidden = true
        status.textContent = error.message || 'Erro ao calcular.'
      }
    })
    $('[data-cardio-compare]').addEventListener('click', () => {
      try {
        const value = compare(reading.value, calculated)
        interpretation.textContent = value === 'dentro'
          ? 'Leitura dentro da faixa estimada. Isso nao prova queima de gordura.'
          : value === 'abaixo'
            ? 'Leitura abaixo da faixa estimada. Nao aumente o esforco apenas para atingir um numero.'
            : 'Leitura acima da faixa estimada. Respeite seus limites e orientacoes profissionais.'
      } catch (error) { interpretation.textContent = error.message }
    })
    remove.addEventListener('click', () => {
      if (key) localStorage.removeItem(key)
      save.checked = false
      form.reset()
      reading.value = ''
      calculated = null
      output.hidden = true
      status.textContent = 'Perfil apagado deste navegador de teste.'
    })
  }
  window.RVCardio = Object.freeze({ calculate, compare, mount })
})()
