import React from 'react';
import {Film} from './Film.jsx';
import {CONFIG} from './config.js';
import {SHOTS} from './shots.js';
import {SUBS} from './subs.js';
import {resolveStyle} from './styles.js';

// 正片
export const Talk = () => (
  <Film shots={SHOTS} subs={SUBS} look={resolveStyle(CONFIG.style)} modules={CONFIG.modules} talk={CONFIG.talk} matte={CONFIG.matte} source={CONFIG.source}
    avatar={CONFIG.avatar} subtitle={CONFIG.subtitle} music={CONFIG.music} handoff={CONFIG.handoff} portraitLayout={CONFIG.portraitLayout} />
);
