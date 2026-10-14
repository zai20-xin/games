import Phaser from 'phaser';
import { buildGameConfig } from './config/GameConfig';

new Phaser.Game(buildGameConfig('contra-l1', 'app'));
