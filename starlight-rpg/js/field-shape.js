// A continuous, star-shaped clearing: every lobe connects through the center.
function boundary(angle) {
  return 0.78 + 0.10 * Math.sin(angle * 3 + 0.4) + 0.07 * Math.cos(angle * 5 - 0.7);
}
export function isInsideField(x, y, width, height, margin = 0) {
  const nx = (x - width / 2) / (width / 2);
  const ny = (y - height / 2) / (height / 2);
  return Math.hypot(nx, ny) <= boundary(Math.atan2(ny, nx)) - margin / (Math.min(width, height) / 2);
}
export function constrainToField(point, width, height, margin = 24) {
  const nx = (point.x - width / 2) / (width / 2);
  const ny = (point.y - height / 2) / (height / 2);
  const distance = Math.hypot(nx, ny);
  const limit = boundary(Math.atan2(ny, nx)) - margin / (Math.min(width, height) / 2);
  const factor = distance > limit ? limit / distance : 1;
  return { x: width / 2 + nx * factor * width / 2, y: height / 2 + ny * factor * height / 2 };
}
