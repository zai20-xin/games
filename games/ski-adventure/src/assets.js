// assets.js —— 图片资源预加载与缓存
import boardMintUrl from './assets/board_mint_3d.png';

export const ASSETS = {
  boardMint: new Image(),
};

export function loadAssets() {
  return new Promise((resolve, reject) => {
    let loaded = 0;
    const total = 1;
    function check() {
      loaded++;
      if (loaded >= total) resolve();
    }

    ASSETS.boardMint.onload = check;
    ASSETS.boardMint.onerror = () => reject(new Error('Failed to load board_mint_3d.png'));
    ASSETS.boardMint.src = boardMintUrl;
  });
}
