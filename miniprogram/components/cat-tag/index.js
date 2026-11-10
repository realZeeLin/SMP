const { CATEGORY } = require('../../utils/format');

Component({
  properties: { category: { type: String, value: 'other' } },
  data: { name: '', color: '', bg: '' },
  observers: {
    category(c) { const m = CATEGORY[c] || CATEGORY.other; this.setData({ name: m.name, color: m.color, bg: m.bg }); },
  },
});
