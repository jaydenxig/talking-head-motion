import React from 'react';
import {Composition} from 'remotion';
import {Talk, PROJECT} from './Talk.jsx';
import {Sample, Teaser, PartsSheet} from './Sample.jsx';
import {CONFIG, sizeOf} from './config.js';

const seconds = Math.max(1, PROJECT.duration);
const size = {fps: CONFIG.fps, ...sizeOf(CONFIG.orientation)};
// 样板可以单独指定横竖屏：inputProps 里传 orientation
const bySize = ({props}) => sizeOf(props.orientation || CONFIG.orientation);
export const Root = () => (
  <>
    <Composition id="Talk" component={Talk} durationInFrames={Math.round(seconds * CONFIG.fps)} {...size} defaultProps={{label: '', noSfx: false}} />
    <Composition id="Sample" component={Sample} durationInFrames={90} {...size} calculateMetadata={bySize} defaultProps={{style: 'tech-1', scene: 'cards3', label: ''}} />
    <Composition id="Teaser" component={Teaser} durationInFrames={120} {...size} calculateMetadata={bySize} defaultProps={{style: 'tech-1', label: ''}} />
    <Composition id="Parts" component={PartsSheet} durationInFrames={1} fps={CONFIG.fps} width={1920} height={1200} defaultProps={{styles: ['tech-1', 'tech-2', 'tech-3']}} />
  </>
);
