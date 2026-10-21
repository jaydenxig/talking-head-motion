import React from 'react';
import {Composition} from 'remotion';
import {Talk} from './Talk.jsx';
import {Sample, Teaser} from './Sample.jsx';
import {CONFIG} from './config.js';
import {SHOTS} from './shots.js';

const seconds = SHOTS[SHOTS.length - 1].to;
const size = {fps: CONFIG.fps, width: CONFIG.width, height: CONFIG.height};
export const Root = () => (
  <>
    <Composition id="Talk" component={Talk} durationInFrames={Math.round(seconds * CONFIG.fps)} {...size} />
    <Composition id="Sample" component={Sample} durationInFrames={90} {...size} defaultProps={{style: 'tech-1', scene: 'cards3', label: ''}} />
    <Composition id="Teaser" component={Teaser} durationInFrames={120} {...size} defaultProps={{style: 'tech-1', label: ''}} />
  </>
);
