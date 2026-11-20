/**
 * Bara i utvecklingsläge: lägger appens store och kommandon på window så att
 * scripts/build-examples.cjs (Playwright) kan bygga exempelprojekten med
 * appens egna funktioner. Ingår inte i produktionsbygget.
 */
import * as core from '@desktopcam/core';
import { useAppStore } from './store/useAppStore';
import * as commands from './cam/commands';
import { importImage } from './cam/imageObjects';
import { buildTextShape } from './text/textShape';
import { loadFont } from './text/fonts';
import { computeToolpath } from './cam/toolpathService';
import * as sim from './cam/simController';

Object.assign(window, { __dc: { core, useAppStore, commands, importImage, buildTextShape, loadFont, computeToolpath, sim } });
