// The header and the reading underlay are views of the same finite survey.
export const surveyHeight = (x,z) => .13*Math.sin(x*.8+z*.5)
  + 3.4*Math.exp(-((x+5.3)**2/10+(z+.7)**2/8))
  + 2.5*Math.exp(-((x-.3)**2/6+(z-2.8)**2/5))
  + 3.0*Math.exp(-((x-6.7)**2/10+(z+1.5)**2/6)) - .4;
export const surveyBoundary = z => 2.6 + .7*Math.sin(z*.75) + .25*Math.sin(z*2.1);
export const surveySample = (i,j) => Math.abs(Math.sin(i*127.1+j*311.7)*43758.5453)%1;
export const surveyAnchors = [[-7.8,2.5],[-3.2,1.5],[1.8,-1.8]];
