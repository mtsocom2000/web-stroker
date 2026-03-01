import { useDrawingStore } from './src/store';

// Test the store directly
const store = useDrawingStore.getState();
console.log('Initial selectMode:', store.selectMode);

store.setSelectMode('line');
console.log('After setSelectMode("line"):', store.selectMode);

store.setSelectMode('point');
console.log('After setSelectMode("point"):', store.selectMode);
