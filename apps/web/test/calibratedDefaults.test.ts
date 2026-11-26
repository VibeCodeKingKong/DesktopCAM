import { describe, expect, it } from 'vitest';
import { calibratedDefaults, useCalibration, type CalibrationRecord } from '../src/calibration/history';

const rec = (p: Partial<CalibrationRecord>): CalibrationRecord => ({
  id: Math.random().toString(36),
  date: '2026-11-26T10:00:00Z',
  testId: 'laser-matrix',
  category: 'laser',
  machineId: 'm',
  machineName: 'M',
  materialId: 'birch-ply',
  materialName: 'Björk',
  thickness: 3,
  values: {},
  measured: {},
  outcomes: [],
  notes: '',
  ...p,
});

describe('förval ur kalibreringen', () => {
  it('använder bara godkända val för samma maskin, material och tjocklek', () => {
    useCalibration.setState({
      loaded: true,
      records: [
        rec({ testId: 'laser-passes', values: { power: 90, speed: 400 }, chosen: { passes: 3 }, approved: ['chosen'] }),
        rec({ testId: 'laser-matrix', values: { mode: 'engrave' }, chosen: { power: 30, speed: 3000 }, approved: ['chosen'] }),
        rec({ testId: 'laser-interval', chosen: { interval: 0.1 }, approved: [] }), // inte godkänd
        rec({ testId: 'laser-matrix', thickness: 6, values: { mode: 'cut' }, chosen: { power: 100, speed: 200 }, approved: ['chosen'] }), // fel tjocklek
        rec({ machineId: 'annan', testId: 'laser-matrix', values: { mode: 'engrave' }, chosen: { power: 5, speed: 9000 }, approved: ['chosen'] }),
      ],
    });
    const d = calibratedDefaults('m', 'birch-ply', 3);
    expect(d.laserCut).toEqual({ passes: 3, power: 90, speed: 400 });
    expect(d.laserEngrave).toEqual({ power: 30, speed: 3000 });
    expect(calibratedDefaults('m', 'mdf', 3)).toEqual({});
  });

  it('fräsvärden gäller bara samma fräsdiameter; sidosteg i procent blir andel', () => {
    useCalibration.setState({
      loaded: true,
      records: [rec({ category: 'router', testId: 'router-finish', toolDiameter: 6, chosen: { stepOver: 40 }, approved: ['chosen'] })],
    });
    expect(calibratedDefaults('m', 'birch-ply', 3, 6).router).toEqual({ stepOver: 0.4 });
    expect(calibratedDefaults('m', 'birch-ply', 3, 3).router).toBeUndefined();
  });
});
