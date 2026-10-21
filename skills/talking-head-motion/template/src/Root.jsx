import React from 'react';
import {Composition} from 'remotion';
import {Talk} from './Talk.jsx';
import {CONFIG} from './config.js';
import {SHOTS} from './shots.js';

const seconds = SHOTS[SHOTS.length - 1].to;
export const Root = () => (
  <Composition id="Talk" component={Talk} durationInFrames={Math.round(seconds * CONFIG.fps)}
    fps={CONFIG.fps} width={CONFIG.width} height={CONFIG.height} />
);
