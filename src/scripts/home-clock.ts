const hands = document.querySelector<SVGGElement>('.home-clock-hands');
const [hourHand, minuteHand] = hands?.children ?? [];

if (hands && hourHand && minuteHand) {
  const now = new Date();
  const minutes = now.getMinutes();
  const hourAngle = ((now.getHours() % 12) + minutes / 60) * 30;
  hourHand.setAttribute('transform', `rotate(${hourAngle})`);
  minuteHand.setAttribute('transform', `rotate(${minutes * 6})`);
  hands.removeAttribute('visibility');
}
