import * as tf from '@tensorflow/tfjs';

// Простая нейронка: принимает [WinRate, PointsPerGame], выдает [Шанс победы]
export async function createAndTrainModel(data: any[]) {
  // 1. Подготовка данных
  const inputs = data.map(d => [d.winRate, d.pointsPerGame / 150]); // Нормализуем очки
  const labels = data.map(d => [d.recentForm === 'W' ? 1 : 0]); // 1 - победа, 0 - поражение

  const inputTensor = tf.tensor2d(inputs);
  const labelTensor = tf.tensor2d(labels);

  // 2. Создание модели
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [2], units: 16, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' })); // Выход 0..1

  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  // 3. Обучение (Train)
  await model.fit(inputTensor, labelTensor, {
    epochs: 50,
    shuffle: true,
  });

  return model;
}

export async function predictWin(model: any, teamStats: number[]) {
  const input = tf.tensor2d([teamStats]);
  const prediction = model.predict(input) as tf.Tensor;
  const value = await prediction.data();
  return value[0]; // Возвращает вероятность (например, 0.75)
}
