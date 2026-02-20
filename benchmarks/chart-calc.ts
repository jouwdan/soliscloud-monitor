import { performance } from 'perf_hooks';

interface DataPoint {
  label: string;
  energy: number;
  gridSell?: number;
  gridPurchased?: number;
  homeLoad?: number;
  batteryCharge?: number;
  batteryDischarge?: number;
}

const generateData = (count: number): DataPoint[] => {
  const data: DataPoint[] = [];
  for (let i = 0; i < count; i++) {
    data.push({
      label: `Day ${i}`,
      energy: Math.random() * 100,
      gridSell: Math.random() > 0.5 ? Math.random() * 50 : 0,
      gridPurchased: Math.random() > 0.5 ? Math.random() * 50 : 0,
      homeLoad: Math.random() * 80,
      batteryCharge: Math.random() > 0.7 ? Math.random() * 30 : 0,
      batteryDischarge: Math.random() > 0.7 ? Math.random() * 30 : 0,
    });
  }
  return data;
};

const calculateAvailable = (data: DataPoint[]) => {
  const available = new Set<string>();
  available.add("energy"); // always show generation
  for (const d of data) {
    if ((d.gridSell || 0) > 0) available.add("gridSell");
    if ((d.gridPurchased || 0) > 0) available.add("gridPurchased");
    if ((d.homeLoad || 0) > 0) available.add("homeLoad");
    if ((d.batteryCharge || 0) > 0) available.add("batteryCharge");
    if ((d.batteryDischarge || 0) > 0) available.add("batteryDischarge");
  }
  return available;
};

const calculateAvailableOptimized = (data: DataPoint[]) => {
  const available = new Set<string>();
  available.add("energy"); // always show generation
  const MAX_KEYS = 6;

  for (const d of data) {
    if (available.size === MAX_KEYS) break;

    if ((d.gridSell || 0) > 0) available.add("gridSell");
    if ((d.gridPurchased || 0) > 0) available.add("gridPurchased");
    if ((d.homeLoad || 0) > 0) available.add("homeLoad");
    if ((d.batteryCharge || 0) > 0) available.add("batteryCharge");
    if ((d.batteryDischarge || 0) > 0) available.add("batteryDischarge");
  }
  return available;
};

const runBenchmark = () => {
  const SAMPLES = 100;
  const DATA_SIZE = 35040;

  const data = generateData(DATA_SIZE);

  console.log(`Benchmarking with ${DATA_SIZE} items over ${SAMPLES} runs...`);

  // Baseline
  const start = performance.now();
  for (let i = 0; i < SAMPLES; i++) {
    calculateAvailable(data);
  }
  const end = performance.now();
  const baselineAvg = (end - start) / SAMPLES;
  console.log(`Baseline Avg: ${baselineAvg.toFixed(4)}ms`);

  // Optimized Loop
  const startOpt = performance.now();
  for (let i = 0; i < SAMPLES; i++) {
    calculateAvailableOptimized(data);
  }
  const endOpt = performance.now();
  const optAvg = (endOpt - startOpt) / SAMPLES;
  console.log(`Optimized Loop Avg: ${optAvg.toFixed(4)}ms`);
  console.log(`Improvement: ${((baselineAvg - optAvg) / baselineAvg * 100).toFixed(2)}%`);

};

runBenchmark();
