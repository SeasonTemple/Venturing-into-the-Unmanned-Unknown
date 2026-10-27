export const stations = [
  { title: '意图', place: '意图前哨', chapter: 'ch1', position: [-10, 0, 24], size: [22, 18], height: 8,
    eye: [1, 4, 34], aim: [-8, 1.4, 23], mobileEye: [3, 6, 39] },
  { title: '设计', place: '设计连桥', chapter: 'ch2', position: [16, 5, -14], size: [32, 9], height: 9,
    eye: [25, 9, -4], aim: [16, 6.5, -16], mobileEye: [27, 11, 1] },
  { title: '实现', place: '实现工坊', chapter: 'ch4', position: [-34, -2, -52], size: [26, 24], height: 10,
    eye: [-21, 3, -39], aim: [-33, .3, -53], mobileEye: [-19, 6, -33] },
  { title: '验证', place: '验证峡口', chapter: 'ch3', position: [28, 2, -64], size: [20, 20], height: 14,
    eye: [38, 6, -51], aim: [28, 6, -65], mobileEye: [40, 9, -46] },
  { title: '交付', place: '交付高架', chapter: 'ch6', position: [68, 10, -106], size: [30, 14], height: 12,
    eye: [78, 14, -94], aim: [64, 11.5, -103], mobileEye: [81, 17, -88] },
  { title: '演进', place: '演进观测区', chapter: 'ch7', position: [24, 8, -154], size: [18, 18], height: 9,
    eye: [28, 11, -159], aim: [23, 11, -206], mobileEye: [28, 12, -156] },
].map((s, index) => ({ ...s, index }));

// Physical route corners. Height refers to the finished walking surface.
export const links = [
  [[-5,0,15],[1,0,6],[7,5,-4],[16,5,-10]],
  [[1,5,-14],[-11,5,-20],[-18,-2,-33],[-26,-2,-40]],
  [[-21,-2,-52],[-9,-2,-53],[4,2,-57],[19,2,-60]],
  [[38,2,-68],[48,2,-77],[54,10,-90],[60,10,-99]],
  [[55,10,-111],[47,10,-123],[37,8,-135],[29,8,-145]],
];
