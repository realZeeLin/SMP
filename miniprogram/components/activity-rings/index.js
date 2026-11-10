/**
 * 同心三环（Apple Fitness 风格），canvas 2d 绘制，圆头端点。
 * <activity-rings values="{{[80, 60, 40]}}" colors="{{['#FF2D55','#34C759','#00C7BE']}}" size="236"/>
 */
Component({
  properties: {
    values: { type: Array, value: [0, 0, 0] },
    colors: { type: Array, value: ['#FF2D55', '#34C759', '#00C7BE'] },
    size: { type: Number, value: 236 }, // rpx
  },
  observers: { 'values, colors, size'() { this.draw(); } },
  lifetimes: { ready() { this.draw(); } },
  methods: {
    draw() {
      this.createSelectorQuery().select('#rings').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const { node: canvas, width, height } = res[0];
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;
        canvas.width = width * dpr; canvas.height = height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        const lw = width * 0.11; const gap = lw * 0.18;
        const cx = width / 2; const cy = height / 2;
        this.data.values.forEach((v, i) => {
          const r = width / 2 - lw / 2 - i * (lw + gap);
          if (r <= lw / 2) return;
          const color = this.data.colors[i] || '#007AFF';
          ctx.lineWidth = lw; ctx.lineCap = 'round';
          ctx.globalAlpha = 0.2; ctx.strokeStyle = color;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
          const p = Math.max(0, Math.min(100, Number(v) || 0)) / 100;
          if (p > 0) {
            ctx.globalAlpha = 1;
            ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(p, 0.01)); ctx.stroke();
          }
        });
      });
    },
  },
});
