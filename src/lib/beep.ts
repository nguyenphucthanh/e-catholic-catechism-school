// Web Audio API Beep Generator
export function playBeep(type: 'success' | 'duplicate' | 'error') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      window.AudioContext || (window as any).webkitAudioContext
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()

    if (type === 'success') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1000, ctx.currentTime)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } else if (type === 'duplicate') {
      const playSingle = (delay: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(600, ctx.currentTime + delay)
        gain.gain.setValueAtTime(0.06, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + delay + 0.08,
        )
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 0.08)
      }
      playSingle(0)
      playSingle(0.12)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (type === 'error') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(120, ctx.currentTime)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    }
  } catch (err) {
    console.warn('AudioContext beep failed:', err)
  }
}
