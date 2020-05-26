/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import React, {useEffect, useRef, useState} from 'react';
import {onBytesReceived} from '../dispatcher/tracking';

export default function NetworkGraph({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTime = useRef(performance.now());
  const lastBytes = useRef(0);
  const pluginStats = useRef<Record<string, number>>({});
  const [hoverText, setHoverText] = useState('');

  useEffect(() => {
    return onBytesReceived((plugin, bytes) => {
      lastBytes.current += bytes;
      if (!pluginStats.current[plugin]) {
        pluginStats.current[plugin] = bytes;
      } else {
        pluginStats.current[plugin] += bytes;
      }
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const deltaTime = performance.now() - lastTime.current;
      lastTime.current = performance.now();
      const deltaBytes = lastBytes.current;
      lastBytes.current = 0;

      // cause kiloBytesPerSecond === bytes per millisecond
      const kiloBytesPerSecond = Math.round(deltaBytes / deltaTime);

      const ctx = canvasRef.current!.getContext('2d')!;
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = kiloBytesPerSecond >= 1000 ? '#f00' : '#ccc';
      ctx.textAlign = 'end';
      ctx.strokeText(`${kiloBytesPerSecond} kB/s`, width - 5, 5 + height / 2);

      setHoverText(
        'Total data traffic per plugin:\n\n' +
          Object.entries(pluginStats.current)
            .sort(([_p, bytes], [_p2, bytes2]) => bytes2 - bytes)
            .map(([key, bytes]) => `${key}: ${Math.round(bytes / 1000)}kb`)
            .join('\n'),
      );
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} width={width} height={height} title={hoverText} />
    </div>
  );
}
