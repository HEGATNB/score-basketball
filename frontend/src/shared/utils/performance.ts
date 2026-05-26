export function measurePerformance(componentName: string) {
  if (import.meta.env.DEV) {
    const start = performance.now();

    return () => {
      const end = performance.now();
      console.log(`Render ${componentName}: ${(end - start).toFixed(2)}ms`);
    };
  }

  return () => {};
}
