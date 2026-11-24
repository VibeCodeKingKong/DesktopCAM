/**
 * Kalibrering och provning: alla tester per maskintyp, G-kod, kontroller och
 * bildanalys. Ett nytt test läggs till i respektive lista; en ny maskintyp får
 * en egen fil och en egen lista här.
 */
import { LASER_TESTS, laserCalibrationGcode } from './laser';
import { PLASMA_TESTS } from './plasma';
import { ROUTER_TESTS } from './router';
import type { CalibrationCategory, CalibrationContext, CalibrationPlan, CalibrationTest } from './types';

export * from './types';
export * from './validate';
export * from './analysis';
export { combineGcodeParts } from './gcode';
export { laserCalibrationGcode, kerfFromSquare } from './laser';

export const CALIBRATION_TESTS: Record<CalibrationCategory, CalibrationTest[]> = {
  laser: LASER_TESTS,
  router: ROUTER_TESTS,
  plasma: PLASMA_TESTS,
};

export const findCalibrationTest = (id: string): CalibrationTest | undefined => Object.values(CALIBRATION_TESTS).flat().find((t) => t.id === id);

/** Provets G-kod: laserns skrivs ur planen, fräs och plasma har den redan. */
export function calibrationGcode(test: CalibrationTest, plan: CalibrationPlan, ctx: CalibrationContext): string {
  return test.category === 'laser' ? laserCalibrationGcode(plan, ctx.machine) : (plan.gcode ?? '');
}
