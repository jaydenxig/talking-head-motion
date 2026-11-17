import React from 'react';
import {Film} from './Film.jsx';
import {CONFIG} from './config.js';
import {SHOTS} from './shots.js';
import {SENTENCES, WORDS, DURATION} from './sentences.js';
import {MEASURED} from './measured.js';
import {resolveStyle} from './styles.js';
import {resolveProject} from './resolve.js';

// 分镜表按句子编号写，这里换算成秒数和节拍（和 npm run check 用的是同一个解析器）
export const PROJECT = resolveProject({config: CONFIG, shots: SHOTS, sentences: SENTENCES, words: WORDS, duration: DURATION, measured: MEASURED});

// 正片
// label：出静帧时显示在顶部的镜号标签（tools/stills.mjs 用），正片不传
// noSfx：出「无音效版」时用（tools/render.mjs）
export const Talk = ({label, noSfx}) => (
  <Film shots={PROJECT.shots} subs={PROJECT.subs} look={resolveStyle(CONFIG.style)} modules={noSfx ? {...CONFIG.modules, sfx: false} : CONFIG.modules} talk={CONFIG.talk} matte={CONFIG.matte} source={CONFIG.source}
    avatar={CONFIG.avatar} subtitle={CONFIG.subtitle} music={CONFIG.music} handoff={CONFIG.handoff} portraitLayout={CONFIG.portraitLayout} measured={MEASURED} label={label} handoffStyle={CONFIG.handoffStyle} drift={CONFIG.drift} />
);
