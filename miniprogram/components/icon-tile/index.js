/** iOS“设置”风格彩色圆角图标：<icon-tile glyph="gear" color="#8E8E93" size="md"/> */
Component({
  properties: {
    glyph: { type: String, value: 'info' },
    color: { type: String, value: '#007AFF' },
    size: { type: String, value: 'md' }, // sm | md | lg | round
  },
});
