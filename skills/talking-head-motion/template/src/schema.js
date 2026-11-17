// 分镜表能填什么：检查器（tools/lint.mjs）、解析器（resolve.js）和「卡片菜单」（npm run cards）都读这一份。
// 加新卡片：在这里登记字段，再去 Film.jsx 写组件、sfx.js 登记节拍。
//
// 字段类型：
//   text     一段字（max = 最多几个汉字宽，英文数字按半个算）
//   number   数字（min / max）
//   bool     true / false
//   image    public/ 下的图片文件名
//   video    public/ 下的视频文件名
//   texts    几行字（min / max 条数，each = 每条最多几个汉字宽）
//   items    几个条目：每条是一段字，或 {text, at}（at = 说到哪个词时出现）
//   anchor   出现时机：写你在这一镜里说的某个词（'发送'；同一个词的第 2 次写 '发送#2'），或写数字 = 这一镜开始后第几秒
//   timed    一段字，或 {text, at}
//   rect     [x, y, 宽, 高]，单位是原图 / 原视频的像素
//   messages 几条对话消息：{from: 'me' | 'ai', text 或 file, at}
//   words    几个词：['email', '张三']
//   focus    要框出来的地方，一个或几个：{text: '图上的字'}（位置由 npm run measure 找）或 {rect: [x, y, 宽, 高]}，
//            都可以加 at（说到哪个词时框）、label（框旁边的小字）、nth（图上有几处同样的字时取第几处）

export const STATES = {
  full: '全屏口播：整张脸出镜。不带图卡，可以叠一个 overlay（章节卡 / 便签 / 小标签）。用在观点、过渡、情绪句',
  pip: '图卡为主：人缩成小窗（竖屏按版式是上图下人 / 浮卡 / 小头像）。用在截图、录屏、数据、清单',
  cutout: '原位抠像：人留在原来的位置、背景换掉，图卡摆在人旁边。需要抠像文件（config.matte），用在总结、对比',
};

export const CARD_TYPES = {
  cards3: {
    name: '编号小卡', example: "{say: 'S02', state: 'pip', card: {type: 'cards3', title: '这期讲三件事', items: ['先声后画', '一句一画', '音效同帧']}}", use: '说「几件事」「几个点」时，一张张编号小卡依次出现',
    fields: {
      kicker: {type: 'text', max: 24, desc: '标题上方的英文小字，如 3 POINTS'},
      title: {type: 'text', required: true, max: 14, desc: '标题'},
      items: {type: 'items', required: true, min: 2, max: 4, each: 10, desc: '每张小卡上的字'},
      mock: {type: 'bool', desc: '这张卡的内容是你编的（不是真截图、真数据）就写 true，角上会标「示意」'},
    },
  },
  list: {
    name: '清单', example: "{say: 'S07-S09', state: 'pip', card: {type: 'list', title: '音效规则', items: ['和动作同帧', {text: '比人声小', at: '人声'}]}}", use: '几条要点逐行出现',
    fields: {
      title: {type: 'text', required: true, max: 16, desc: '标题'},
      items: {type: 'items', required: true, min: 2, max: 6, each: 15, desc: '每一行'},
      mock: {type: 'bool', desc: '这张卡的内容是你编的（不是真截图、真数据）就写 true，角上会标「示意」'},
    },
  },
  window: {
    name: '窗口', example: "{say: 'S04', state: 'pip', card: {type: 'window', title: '设置页', img: 'shot-03.png', focus: {text: '打开浏览器'}, pill: '一个开关就够了'}}", use: '把截图或几行文字装进一个电脑窗口里；img 和 lines 至少写一个',
    fields: {
      title: {type: 'text', required: true, max: 20, desc: '窗口标题栏上的字'},
      img: {type: 'image', desc: '截图文件'},
      lines: {type: 'texts', min: 1, max: 5, each: 24, desc: '没有截图时，用几行字代替'},
      highlight: {type: 'number', min: 0, desc: '高亮第几行（从 0 数），只对 lines 有效'},
      highlightAt: {type: 'anchor', desc: '说到哪个词时高亮'},
      focus: {type: 'focus', needs: 'img', desc: '在截图上框出重点'},
      crop: {type: 'rect', needs: 'img', desc: '只显示截图的这一块'},
      scroll: {type: 'bool', needs: 'img', desc: '长截图从上往下滚动着看'},
      zoom: {type: 'number', min: 1, max: 1.6, desc: '高亮时整个窗口放大到几倍'},
      mask: {type: 'words', needs: 'img', desc: "要糊掉的字：'email' 邮箱、'phone' 手机号、'money' 金额和薪资，或者直接写要糊的词（名字、公司名）"},
      mock: {type: 'bool', desc: '这张卡的内容是你编的（不是真截图、真数据）就写 true，角上会标「示意」'},
      pill: {type: 'timed', max: 20, desc: '窗口下面的一句结论'},
    },
    oneOf: ['img', 'lines'],
  },
  image: {
    name: '截图', example: "{say: 'S10-S11', state: 'pip', card: {type: 'image', img: 'chat.png', caption: '它发来的消息', focus: [{text: '面试邀请', at: '面试'}], scroll: true}}", use: '一张截图或图片（手机截图、长图也行），不带窗口边框，可以框重点、可以滚动',
    fields: {
      img: {type: 'image', required: true, desc: '图片文件'},
      caption: {type: 'text', max: 20, desc: '图片上方的小标题，说明「这是什么」'},
      focus: {type: 'focus', desc: '在图上框出重点'},
      crop: {type: 'rect', desc: '只显示图片的这一块'},
      scroll: {type: 'bool', desc: '长图从上往下滚动着看'},
      mask: {type: 'words', desc: "要糊掉的字：'email' 邮箱、'phone' 手机号、'money' 金额和薪资，或者直接写要糊的词（名字、公司名）"},
      mock: {type: 'bool', desc: '这张卡的内容是你编的（不是真截图、真数据）就写 true，角上会标「示意」'},
      pill: {type: 'timed', max: 20, desc: '图片下面的一句结论'},
    },
  },
  screen: {
    name: '录屏', example: "{say: 'S12-S15', state: 'pip', card: {type: 'screen', src: 'rec.mp4', start: 42.5, label: '实机画面', focus: [{text: '发送', at: '点发送'}]}}", use: '讲操作时放录屏或实机画面：素材占满，人在小窗里。同一段录屏连着几镜用，中间不会重新弹出来',
    fields: {
      src: {type: 'video', required: true, desc: '录屏文件'},
      start: {type: 'number', min: 0, desc: '从录屏的第几秒开始放（同一段录屏接着上一镜往下放时可以不写）'},
      rate: {type: 'number', min: 0.5, max: 3, desc: '播放速度，默认 1'},
      label: {type: 'text', max: 20, desc: '左上角的小标签，说明「这是什么」'},
      focus: {type: 'focus', desc: '在录屏上框出正在讲的按钮或文字'},
      crop: {type: 'rect', desc: '只显示录屏的这一块（比如裁掉浏览器的标签栏和 Dock）'},
      sound: {type: 'bool', desc: '保留录屏自己的声音，默认不保留'},
      mock: {type: 'bool', desc: '这张卡的内容是你编的（不是真截图、真数据）就写 true，角上会标「示意」'},
      pill: {type: 'timed', max: 20, desc: '录屏下面的一句结论'},
    },
  },
  chat: {
    name: '对话', example: "{say: 'S17-S22', state: 'pip', why: '看到怎么跟 AI 说、把简历发过去', card: {type: 'chat', title: 'AI 助手', messages: [{from: 'me', text: '总结一下我们聊过的内容', at: '聊天记录'}, {from: 'me', file: '最新简历.pdf', at: '简历'}, {from: 'ai', text: '好的，已经整理出 3 个亮点', at: '亮点'}]}}",
    use: '把「跟 AI 说一句话、发一个文件、它回复」这个动作演出来。讲操作但没有真截图、真录屏时用它，不要退成文字清单。角上自动标「示意」',
    fields: {
      title: {type: 'text', max: 12, desc: '对话框顶上的名字，如 AI 助手'},
      messages: {type: 'messages', required: true, min: 1, max: 5, each: 26, desc: "几条消息，按顺序出现：{from: 'me' 或 'ai', text: '一句话'}，或发文件 {from: 'me', file: '文件名.pdf'}；都可以加 at"},
      pill: {type: 'timed', max: 20, desc: '对话框下面的一句结论'},
      mock: {type: 'bool', desc: '默认标「示意」；内容是照真实对话原样抄的才写 false'},
    },
  },
  flow: {
    name: '流程', example: "{say: 'S08-S09', state: 'pip', why: '一眼看懂整件事：简历交给 AI，AI 去平台上投', card: {type: 'flow', steps: [{text: '我的简历', icon: 'doc'}, {text: 'AI 助手', icon: 'ai', at: '通过 AI'}, {text: '招聘平台', icon: 'web', at: '投简历'}]}}",
    use: '一件事从哪到哪：东西依次经过几站（「简历 → AI → 招聘平台」），说到哪一站亮哪一站',
    fields: {
      title: {type: 'text', max: 16, desc: '上方的标题'},
      steps: {type: 'items', required: true, min: 2, max: 4, each: 8, icon: true, desc: '每一站的名字；可以写成 {text, at, icon}，icon 可选 doc 文档 / chat 对话 / ai / web 网页 / person 人 / mail 邮件 / clock 时间 / search 搜索 / phone 手机 / check 完成'},
      pill: {type: 'timed', max: 20, desc: '下面的一句结论'},
      mock: {type: 'bool', desc: '默认标「示意」'},
    },
  },
  doc: {
    name: '文档', example: "{say: 'S23-S27', state: 'pip', why: '看到 AI 在简历上挖出了原来没写的亮点', card: {type: 'doc', title: '我的简历', scan: true, marks: [{text: '没写进去的能力', at: '挖掘'}, {text: '对口岗位的亮点', at: '亮点'}], stamp: {text: '新版简历', at: '生成'}}}",
    use: '一页文档被扫描、划出重点、盖上结果（「优化简历」「从报告里挑出三条」）。讲的是处理一份文件、又没有真文件可以放时用',
    fields: {
      title: {type: 'text', required: true, max: 12, desc: '文档的标题，如 我的简历'},
      marks: {type: 'items', min: 1, max: 4, each: 12, desc: '在文档上划出来的重点，一条条出现'},
      scan: {type: 'bool', desc: '出场时有一道光从上往下扫一遍（表示「AI 在读」）'},
      stamp: {type: 'timed', max: 8, desc: '最后盖在文档上的结果，如 新版简历、已通过'},
      mock: {type: 'bool', desc: '默认标「示意」'},
    },
  },
  stat: {
    name: '大数字', example: "{say: 'S05', state: 'pip', card: {type: 'stat', title: '只花了', value: 4, unit: ' 天'}}", use: '一个数字滚动到目标值',
    fields: {
      kicker: {type: 'text', max: 24, desc: '标题上方的英文小字'},
      title: {type: 'text', required: true, max: 16, desc: '这个数字是什么'},
      value: {type: 'number', required: true, desc: '数字'},
      unit: {type: 'text', max: 6, desc: '单位，如 秒、%、万'},
      note: {type: 'text', max: 20, desc: '数字下面的补充说明'},
      at: {type: 'anchor', desc: '说到哪个词时数字停住，不写就自动找你说这个数字的地方'},
      mock: {type: 'bool', desc: '这张卡的内容是你编的（不是真截图、真数据）就写 true，角上会标「示意」'},
    },
  },
  pill: {
    name: '结论胶囊', example: "{say: 'S20', state: 'pip', card: {type: 'pill', text: '时间轴先定，画面再跟上'}}", use: '单独一句结论',
    fields: {text: {type: 'text', required: true, max: 20, desc: '结论'}},
  },
  quote: {
    name: '引用', example: "{say: 'S03', state: 'pip', card: {type: 'quote', text: '它太勤快了', by: '我朋友'}}", use: '引用别人的一段话',
    fields: {
      text: {type: 'text', required: true, max: 60, desc: '原话'},
      by: {type: 'text', max: 16, desc: '谁说的'},
      mock: {type: 'bool', desc: '这张卡的内容是你编的（不是真截图、真数据）就写 true，角上会标「示意」'},
    },
  },
};

export const OVERLAY_TYPES = {
  chapter: {name: '章节卡', example: "{say: 'S03', state: 'full', overlay: {type: 'chapter', part: 'PART 01', title: '眼里有活'}}", use: '进入新的一部分时', fields: {part: {type: 'text', max: 12, desc: '如 PART 01'}, title: {type: 'text', required: true, max: 10, desc: '这一部分的名字'}}},
  note: {name: '便签', example: "{say: 'S06', state: 'full', overlay: {type: 'note', text: '音效只用真实录音'}}", use: '一句重点', fields: {text: {type: 'text', required: true, max: 14, desc: '便签上的字'}}},
  tag: {name: '小标签', example: "{say: 'S01', state: 'full', overlay: {type: 'tag', text: '实机画面 · 没有加速'}}", use: '说明「这是什么」', fields: {text: {type: 'text', required: true, max: 20, desc: '标签上的字'}}},
};

export const SHOT_FIELDS = {
  say: '这一镜对应哪几句话：\'S03\'、\'S03-S05\' 或 [\'S03\', \'S04\']',
  state: `画面状态：${Object.keys(STATES).join(' / ')}`,
  card: 'pip / cutout 时的图卡',
  overlay: 'full 时叠在人像上的小卡片',
  why: '观众第一次看到这个画面能明白什么（一句话）。写不出来，说明这个画面该删',
  memo: '给自己和用户看的备注，不会出现在画面里',
  from: '（旧写法）开始秒数', to: '（旧写法）结束秒数',
};
