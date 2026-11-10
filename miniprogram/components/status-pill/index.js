const { STATUS } = require('../../utils/format');

Component({
  properties: { status: { type: String, value: '' } },
  data: { name: '', tone: 'gray' },
  observers: {
    status(s) { const m = STATUS[s] || { name: s, tone: 'gray' }; this.setData({ name: m.name, tone: m.tone }); },
  },
});
