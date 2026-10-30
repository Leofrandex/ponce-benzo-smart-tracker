// Estilos del tablero del editor de ruta (mismo patrón de <style> en línea que RutaSemanal).
export const ESTILOS_EDITOR = `
  .ed-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 14px; border-bottom: 1px solid var(--border); font-size: var(--text-sm); }
  .ed-aviso { padding: 8px 14px; font-size: var(--text-sm); color: var(--warning); background: var(--warning-bg); border-bottom: 1px solid var(--border); font-weight: 600; }
  .ed-board-wrap { position: relative; overflow-x: auto; background: var(--bg-base); }
  .ed-board { display: grid; grid-template-columns: repeat(5, minmax(170px, 1fr)); gap: 10px; padding: 14px; min-width: 900px; }
  .ed-col { background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 8px; display: flex; flex-direction: column; height: 460px; min-width: 0;
    box-shadow: inset 0 0 0 2px transparent; transition: box-shadow var(--duration) var(--ease); }
  .ed-col-over { box-shadow: inset 0 0 0 2px var(--border-accent); }
  .ed-list { list-style: none; margin: 0; padding: 0 2px 0 0; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; min-height: 40px; }
  .ed-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 7px 8px; font-size: var(--text-xs);
    display: flex; gap: 6px; align-items: flex-start; cursor: grab; touch-action: none; user-select: none; }
  .ed-card:hover { border-color: var(--border-accent); }
  .ed-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
  .ed-card-off { opacity: 0.45; border-style: dashed; }
  .ed-card-sel { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
  .ed-card-drag { cursor: grabbing; box-shadow: 0 10px 24px rgba(0, 32, 92, 0.18); }
  .ed-chip { display: inline-block; margin-top: 4px; padding: 1px 6px; border-radius: 999px; font-size: 10px; background: var(--bg-elevated); color: var(--text-secondary); }
  .ed-chip-n { background: var(--accent-glow); color: var(--accent); font-weight: 600; }
  .ed-add { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 8px; padding: 7px; width: 100%;
    border: 1px dashed var(--border-accent); border-radius: 6px; background: transparent; color: var(--text-secondary); font-size: var(--text-xs); font-family: inherit; cursor: pointer; }
  .ed-add:hover { background: var(--bg-card); color: var(--text-primary); }
  .ed-result { display: block; width: 100%; text-align: left; padding: 6px 8px; background: transparent; border: none; font-family: inherit; font-size: var(--text-xs); color: var(--text-primary); cursor: pointer; }
  .ed-result:hover, .ed-result:focus-visible { background: var(--bg-base); }
  .ed-pop { position: absolute; right: 16px; top: 16px; width: 260px; z-index: 5; background: var(--bg-surface); border: 1px solid var(--border);
    border-radius: var(--radius-sm); box-shadow: 0 10px 30px rgba(0, 32, 92, 0.18); padding: 12px; font-size: var(--text-xs); }
  .ed-label { color: var(--text-secondary); font-size: var(--text-xs); }
  .ed-seg { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin: 4px 0 10px; }
  .ed-seg button { flex: 1; padding: 5px 2px; border: none; border-right: 1px solid var(--border); background: transparent; font-family: inherit; font-size: var(--text-xs); color: var(--text-primary); cursor: pointer; }
  .ed-seg button:last-child { border-right: 0; }
  .ed-seg button.on { background: var(--accent); color: #fff; font-weight: 600; }
`;
