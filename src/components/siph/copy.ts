// 波导示意图上的句子。中文是原文，英文跟着「光为什么会走在波导里」的口气。
// 静态 HTML 在构建时按页面语言取；画布上的字在浏览器里读 <html lang>。

export type SiphLang = 'zh' | 'en';

export function siphLang(): SiphLang {
  if (typeof document === 'undefined') return 'zh';
  return document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

const zh = {
  play: '播放',
  pause: '暂停',
  playAria: '播放动画',
  pauseAria: '暂停动画',
  schematic: '示意图',
  slab: {
    title: '芯层收到 220 nm，光线这幅图就不够用',
    thickness: '厚度',
    caption:
      '滑杆从很厚收到 220 nm。厚的时候画全反射，厚度是故意夸大的；收到右边，芯层与 λ0 用同一比例，光线换成不变形的亮带和包层里的尾巴。这里先不区分 TE 和 TM。',
    thick: '芯层画得很厚，光线在两个界面之间全反射。厚度是夸大的，用来把反射看清楚。',
    mid: '芯层往 220 nm 收。折返还在，但一条细光线已经盛不下这个尺寸。',
    thin: '与下方 λ0 同一比例。220 nm 只有波长的大约七分之一，截面上是一条不变形的亮带，包层里留下衰减的尾巴。',
    silicon: '硅  n ≈ 3.5',
    oxide: '氧化硅  n ≈ 1.44',
    normal: '法线',
    scaleExaggerated: '厚芯是示意图，λ0 的比例尺始终为真',
    scaleTrue: '芯层与 λ0 同一比例',
  },
  neff: {
    title: 'neff 要落在氧化硅和硅之间',
    third: '第三个根 · 1.492897',
    note: '浅色带从左端的氧化硅 1.44 到右端的硅 3.5。靠在左墙边上的那一点是丢掉的根，往右依次是 TM0 和 TE0。',
    caption:
      '拖动 neff，或点上面三个解。尾巴的长短按 1/√(neff² − 1.44²)，只用这个大约的包层折射率，不是另一次仿真。滑过的中间值不是这根 500 nm 条的导模。',
    oxide: '氧化硅，n 约 1.44',
    discarded: '丢掉的根，1.493',
    silicon: '硅，n 约 3.5',
    core: '硅芯',
    radiating: '包层里开始振荡',
    tail: '包层里的尾巴',
    atClad: 'neff 低到了氧化硅。包层里不再是衰减的尾巴，场不被这根条束缚。',
    atThird:
      '第三个根，neff = 1.492897，贴着 n_SiO₂。衰减已经很慢。上一篇里它是辐射场碰上 PML 的假象，丢掉。',
    atTm: 'TM0，neff = 1.771059。比 TE0 更靠近氧化硅，同样的公式下尾巴更长。',
    atTe: 'TE0，neff = 2.445347。落在窗口中段，包层里掉得快。',
    between: (n: string) =>
      `示意 neff = ${n}。尾巴按 1/√(neff² − 1.44²) 变化。滑过的中间值不是这根 500 nm 条的解，解只有标出来的两个导模。`,
  },
  portrait: {
    aria: 'TE0 与 TM0 的截面示意图',
    title: 'TE0 的电场沿宽度，TM0 沿厚度',
    choose: '选择模',
    both: '并排',
    phase: '相位',
    phaseAria: '时间相位，单位度',
    heat: '|E|² 包络，各自归一',
    forward: '瞬时 E 的正向',
    reverse: '反向',
    caption:
      '500 nm × 220 nm 的硅条，按比例画在氧化硅里。箭头是主导电场：TE0 水平，TM0 竖直，随 cos(ωt) 一起伸缩、反向。色块是定性的 |E|²，不是 FDE 网格。暂停时相位停在箭头最长的一帧。',
    te: 'TE0。箭头沿宽度，是 Ex，与上下两个大面相切。色块收在硅芯里，左右略微探出侧壁。',
    tm: 'TM0。箭头沿厚度，是 Ey。上下边外侧的箭头比芯里更长：法向电场在氧化硅里更大，所以能量往上下包层交。',
    bothNarrow: '上边 TE0，下边 TM0。同一时刻，箭头一起伸缩。色块各自归一，不能拿亮度比功率。',
    bothWide: '左边 TE0，右边 TM0。同一时刻，箭头一起伸缩。色块各自归一，不能拿亮度比功率。',
    oxide: '氧化硅',
    teTitle: 'TE0 · 准横电',
    tmTitle: 'TM0 · 准横磁',
    teSub: '主导电场 Ex，沿宽度',
    tmSub: '主导电场 Ey，沿厚度',
  },
  travel: {
    aria: '导模沿 z 传播的示意图',
    title: '同一光频，TE0 的波长更短，也更慢',
    choose: '选择画在硅条上的模',
    compare: '对照另一模',
    time: '时间',
    phaseAria: '时间相位，单位度',
    caption:
      '右边的硅条和下面的曲线共用 3.2 µm 的 z 轴。截面用真比例，所以条很扁；左图把端面放大，倍数写在图上。颜色和曲线是 Re{E exp[j(ωt − βz)]}，波峰向 +z 走。对照曲线只为比较波长和相速度，没有把两个模加在一起。',
    mag: (n: string) => `端面放大约 ${n} 倍`,
    strip: '硅条 · 与 z 同一比例',
    axis: 'Re{E}  纵轴是示意',
    head: (name: string, neff: string, lg: number, vp: string, mag: string) =>
      `${name}  neff ${neff}，导波波长 ${lg} nm，相速度 ${vp} c。端面约放大 ${mag} 倍，长条本身不放大。`,
    compareTail: (name: string, lg: number, vp: string) =>
      `虚线是 ${name}：${lg} nm，${vp} c。两条曲线只是放在一起比较，没有相加成一个场。`,
  },
};

const en = {
  play: 'Play',
  pause: 'Pause',
  playAria: 'Play the animation',
  pauseAria: 'Pause the animation',
  schematic: 'Schematic',
  slab: {
    title: 'Once the core is down at 220 nm, the ray picture is no longer enough',
    thickness: 'Thickness',
    caption:
      'The slider pulls a thick core down to 220 nm. While it is thick, the drawing is total internal reflection, and the thickness is exaggerated on purpose. At the right-hand end the core shares a scale with λ0, and the ray becomes a band that does not change shape, with a tail in the cladding. TE and TM are not separated yet.',
    thick: 'The core is drawn very thick. A ray totally reflects between the two interfaces. The thickness is exaggerated so the reflection is easy to see.',
    mid: 'The core is closing in on 220 nm. The folding back is still there, but a thin ray can no longer hold this size.',
    thin: 'Same scale as the λ0 bar below. 220 nm is about a seventh of the wavelength. On the cross-section it is a band that does not change shape, and a decaying tail is left in the cladding.',
    silicon: 'Si  n ≈ 3.5',
    oxide: 'SiO₂  n ≈ 1.44',
    normal: 'normal',
    scaleExaggerated: 'Thick core is a sketch; the λ0 scale stays true',
    scaleTrue: 'Core and λ0 on one scale',
  },
  neff: {
    title: 'neff has to land between the oxide and the silicon',
    third: 'Third root · 1.492897',
    note: 'The pale band runs from oxide at 1.44 on the left to silicon at 3.5 on the right. The point against the left wall is the discarded root; moving right, TM0, then TE0.',
    caption:
      'Drag neff, or click one of the three roots. Tail length follows 1/√(neff² − 1.44²), using only this approximate cladding index, not another simulation. Values you slide through in between are not guided modes of this 500 nm strip.',
    oxide: 'oxide, n ≈ 1.44',
    discarded: 'discarded root, 1.493',
    silicon: 'silicon, n ≈ 3.5',
    core: 'Si core',
    radiating: 'The cladding starts to oscillate',
    tail: 'Tail in the cladding',
    atClad: 'neff has dropped to the oxide. The cladding is no longer a decaying tail. The field is not bound by this strip.',
    atThird:
      'The third root, neff = 1.492897, stuck against n_SiO₂. The decay is already very slow. In the previous note it was a radiating field meeting the PML, an artifact, and it was thrown out.',
    atTm: 'TM0, neff = 1.771059. Closer to the oxide than TE0, so under the same formula the tail is longer.',
    atTe: 'TE0, neff = 2.445347. Mid-window. It falls off quickly in the cladding.',
    between: (n: string) =>
      `Schematic neff = ${n}. The tail follows 1/√(neff² − 1.44²). Values slid through in between are not solutions of this 500 nm strip. The only guided modes are the two that are marked.`,
  },
  portrait: {
    aria: 'Schematic cross-sections of TE0 and TM0',
    title: 'The field of TE0 runs along the width, TM0 along the thickness',
    choose: 'Choose a mode',
    both: 'Both',
    phase: 'Phase',
    phaseAria: 'Time phase, in degrees',
    heat: '|E|² envelope, each normalized to itself',
    forward: 'Instantaneous E, positive',
    reverse: 'Reversed',
    caption:
      'A 500 nm × 220 nm silicon strip, drawn to scale in oxide. Arrows are the dominant electric field: TE0 horizontal, TM0 vertical, stretching and reversing together with cos(ωt). The color is a qualitative |E|², not an FDE grid. When paused, the phase sits on the frame where the arrows are longest.',
    te: 'TE0. The arrows run along the width, Ex, tangent to the two large faces. The color stays in the silicon core and pokes slightly out of the sidewalls.',
    tm: 'TM0. The arrows run along the thickness, Ey. Outside the top and bottom edges they are longer than inside the core: the normal field is larger in the oxide, so energy is handed to the cladding above and below.',
    bothNarrow: 'TE0 above, TM0 below. At one instant the arrows stretch together. Each color field is normalized to itself; brightness is not power.',
    bothWide: 'TE0 on the left, TM0 on the right. At one instant the arrows stretch together. Each color field is normalized to itself; brightness is not power.',
    oxide: 'oxide',
    teTitle: 'TE0 · quasi-TE',
    tmTitle: 'TM0 · quasi-TM',
    teSub: 'Dominant field Ex, along the width',
    tmSub: 'Dominant field Ey, along the thickness',
  },
  travel: {
    aria: 'Schematic of a guided mode traveling along z',
    title: 'Same optical frequency: TE0 has the shorter wavelength, and it is slower',
    choose: 'Mode drawn on the strip',
    compare: 'Compare the other',
    time: 'Time',
    phaseAria: 'Time phase, in degrees',
    caption:
      'The silicon strip on the right and the curves below share a 3.2 µm z axis. The cross-section is true scale, so the strip is flat; the drawing on the left magnifies the end face, and the factor is written on the figure. Color and curves are Re{E exp[j(ωt − βz)]}. Peaks walk toward +z. The comparison curve is there to compare wavelength and phase velocity. The two modes are not added into one field.',
    mag: (n: string) => `End face about ${n}×`,
    strip: 'Silicon strip · same scale as z',
    axis: 'Re{E}  vertical axis is a sketch',
    head: (name: string, neff: string, lg: number, vp: string, mag: string) =>
      `${name}  neff ${neff}, guided wavelength ${lg} nm, phase velocity ${vp} c. End face magnified about ${mag}×. The long strip itself is not magnified.`,
    compareTail: (name: string, lg: number, vp: string) =>
      `The dashed curve is ${name}: ${lg} nm, ${vp} c. The two curves are only laid together for comparison. They are not summed into one field.`,
  },
};

export type SiphCopy = typeof zh;

export function siphCopy(lang: SiphLang = siphLang()): SiphCopy {
  return lang === 'en' ? en : zh;
}
