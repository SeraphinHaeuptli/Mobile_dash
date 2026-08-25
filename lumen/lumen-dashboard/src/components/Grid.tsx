'use client';
import React from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const SizedGrid = WidthProvider(GridLayout);

interface Props {
  layout: Layout[];
  cols: number;
  editing: boolean;
  onLayoutChange: (l: Layout[]) => void;
  children: React.ReactNode;
}

export default function Grid({ layout, cols, editing, onLayoutChange, children }: Props) {
  return (
    <SizedGrid
      className="layout"
      layout={layout}
      cols={cols}
      rowHeight={40}
      margin={[10, 10]}
      containerPadding={[0, 0]}
      isDraggable={editing}
      isResizable={editing}
      draggableHandle=".drag-handle"
      draggableCancel=".widget-actions"
      onLayoutChange={onLayoutChange}
      compactType="vertical"
    >
      {children}
    </SizedGrid>
  );
}
