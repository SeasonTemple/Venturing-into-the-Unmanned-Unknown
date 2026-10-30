// Single-direction finite lane. Artwork and displacement share the same tracks.
export class LaneMotion {
  constructor(data) { this.data=data; this.reset(); }
  reset() {
    Object.assign(this,{clip:'start',frame:0,origin:0,mode:'idle',target:0,
      stopRequested:false,resumeAfterStop:false,carry:0,distance:0});
  }
  get roots() { return this.data.clips[this.clip].rootX; }
  get x() { return this.origin+this.roots[this.frame]; }
  get renderX() {
    if (!this.active) return this.x;
    const next=this.mode==='launch'?Math.max(0,this.frame-2):Math.min(this.frame+1,this.roots.length-1);
    return this.x+(this.roots[next]-this.roots[this.frame])*this.carry;
  }
  get active() { return this.mode!=='idle'; }
  moveTo(target) {
    this.target=Math.max(-380,Math.min(0,target));
    if (this.target>=this.x-.1) { this.stop(); return; }
    this.stopRequested=false;
    if (this.mode==='stop') this.resumeAfterStop=true;
    if (this.mode==='idle') this.mode=this.clip==='start'?'start':'launch';
  }
  stop() { this.stopRequested=true; this.resumeAfterStop=false; }
  place(target) {
    this.reset(); this.origin=Math.max(-380,Math.min(0,target)); this.target=this.origin;
  }
  considerStop() {
    if (this.frame!==0 && this.frame!==16) return;
    const clip=this.frame===0?'stop-L':'stop-R';
    const stopX=this.x+this.data.clips[clip].rootX.at(-1);
    if (!this.stopRequested && stopX>this.target+.01) return;
    this.origin=this.x; this.clip=clip; this.frame=0; this.mode='stop';
  }
  step() {
    const before=this.x;
    if (this.mode==='start') {
      this.frame++;
      if (this.frame===this.roots.length-1) {
        this.origin=this.x; this.clip='stride'; this.frame=0; this.mode='stride'; this.considerStop();
      }
    } else if (this.mode==='stride') {
      this.frame++;
      if (this.frame===32) { this.frame=0; this.origin-=86; }
      this.considerStop();
    } else if (this.mode==='stop') {
      if (++this.frame===this.roots.length-1) {
        this.mode=this.resumeAfterStop&&this.target<this.x-.1?'launch':'idle';
        this.resumeAfterStop=false;
      }
    } else if (this.mode==='launch') {
      // Releasing a planted stance rocks the weight back onto the trailing toe.
      // The same sole anchors stay fixed, including during this small recoil.
      this.frame=Math.max(0,this.frame-2);
      if (this.frame===0) {
        const phase=this.clip==='stop-L'?0:16;
        this.clip='stride'; this.origin+=phase===16?43:0;
        this.frame=phase; this.mode='stride'; this.considerStop();
      }
    }
    this.distance+=Math.abs(this.x-before);
  }
  tick(seconds) {
    if (!this.active) return false;
    this.carry+=Math.min(.05,Math.max(0,seconds))*this.data.fps;
    let changed=false;
    while (this.carry>=1 && this.active) { this.carry--; this.step(); changed=true; }
    if (!this.active) this.carry=0;
    return changed;
  }
  snapshot() {
    return {clip:this.clip,frame:this.frame,mode:this.mode,x:this.x,target:this.target,
      stopRequested:this.stopRequested,active:this.active};
  }
}
