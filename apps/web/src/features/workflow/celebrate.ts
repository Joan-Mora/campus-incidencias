import confetti from 'canvas-confetti';

/** Confeti breve con los colores del tema al verificar un arreglo. */
export function celebrate() {
  const styles = getComputedStyle(document.documentElement);
  const colors = ['--level-low', '--level-medium', '--accent'].map((name) => styles.getPropertyValue(name).trim());
  confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin: { y: 0.7 }, colors, disableForReducedMotion: true, scalar: 0.9 });
}
