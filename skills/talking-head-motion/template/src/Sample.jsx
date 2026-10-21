import React from 'react';
import {Film} from './Film.jsx';
import {CONFIG} from './config.js';
import {SAMPLE} from './samples.js';
import {resolveStyle} from './styles.js';

const ALL = {cards: true, overlays: true, avatar: true, subtitles: true, sfx: true, music: false};

// 每个样板画面 3 秒，取第 80 帧出静帧（这时内容都已出全）
const scene = (name) => {
  const S = SAMPLE;
  if (name === 'chapter') return {shot: {from: 0, to: 3, state: 'full', overlay: {type: 'chapter', part: S.chapter.part, title: S.chapter.title}}, sub: S.chapter.sub};
  if (name === 'cards3') return {shot: {from: 0, to: 3, state: 'pip', card: {type: 'cards3', ...S.cards3}}, sub: S.cards3.sub};
  if (name === 'window') return {shot: {from: 0, to: 3, state: 'pip', card: {type: 'window', ...S.window}}, sub: S.window.sub};
  return {shot: {from: 0, to: 3, state: 'pip', card: {type: 'list', ...S.list}}, sub: S.list.sub};
};

const common = (style, modules) => ({
  look: resolveStyle(style), modules: {...ALL, ...modules}, talk: CONFIG.talk, matte: CONFIG.matte,
  avatar: CONFIG.avatar, subtitle: CONFIG.subtitle, music: CONFIG.music, handoff: CONFIG.handoff,
});

export const Sample = ({style, scene: name, label, modules}) => {
  const {shot, sub} = scene(name);
  return <Film {...common(style, modules)} shots={[shot]} subs={[{from: 0, to: 3, text: sub}]} label={label} />;
};

// 4 秒小动图：全屏 + 章节卡 → 图卡 + 小头像，带这套风格的音效包
export const Teaser = ({style, label, modules}) => {
  const S = SAMPLE;
  const shots = [
    {from: 0, to: 1.4, state: 'full', overlay: {type: 'chapter', part: S.chapter.part, title: S.chapter.title}},
    {from: 1.4, to: 4, state: 'pip', card: {type: 'cards3', ...S.cards3}},
  ];
  const subs = [{from: 0, to: 1.4, text: S.chapter.sub}, {from: 1.4, to: 4, text: S.cards3.sub}];
  return <Film {...common(style, modules)} shots={shots} subs={subs} label={label} />;
};
