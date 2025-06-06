
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';

interface Style {
  id: string;
  value: string;
}

interface Target {
  id: string;
  targetName: string;
  styles: Style[];
}

const newId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [targets, setTargets] = useState<Target[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Drag state
  const draggedItem = useRef<{ type: 'target' | 'style'; id: string; parentId?: string } | null>(null);
  const dragOverItem = useRef<{ type: 'target' | 'style'; id: string; parentId?: string } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string; before: boolean } | { styleParentId: string; styleId: string; before: boolean } | null>(null);


  const parseInputData = useCallback((jsonData: Record<string, string>): Target[] => {
    const tempTargets: { [key: number]: { targetName?: string; styles: { [key: number]: string } } } = {};
    for (const key in jsonData) {
      const targetMatch = key.match(/^controlStyles\[(\d+)\]\.target$/);
      const styleMatch = key.match(/^controlStyles\[(\d+)\]\.styles\[(\d+)\]$/);

      if (targetMatch) {
        const index = parseInt(targetMatch[1], 10);
        if (!tempTargets[index]) tempTargets[index] = { styles: {} };
        tempTargets[index].targetName = jsonData[key];
      } else if (styleMatch) {
        const targetIndex = parseInt(styleMatch[1], 10);
        const styleIndex = parseInt(styleMatch[2], 10);
        if (!tempTargets[targetIndex]) tempTargets[targetIndex] = { styles: {} };
        if (!tempTargets[targetIndex].styles) tempTargets[targetIndex].styles = {};
        tempTargets[targetIndex].styles[styleIndex] = jsonData[key];
      }
    }

    const result: Target[] = [];
    Object.keys(tempTargets).map(Number).sort((a, b) => a - b).forEach(targetIndexKey => {
      const tempTarget = tempTargets[targetIndexKey];
      if (tempTarget && typeof tempTarget.targetName === 'string') {
        const stylesArray: Style[] = [];
        if (tempTarget.styles) {
          Object.keys(tempTarget.styles).map(Number).sort((a, b) => a - b).forEach(styleKey => {
            stylesArray.push({ id: newId(), value: tempTarget.styles[styleKey] });
          });
        }
        result.push({ id: newId(), targetName: tempTarget.targetName, styles: stylesArray });
      }
    });
    return result;
  }, []);

  const handleLoadJson = () => {
    try {
      setError(null);
      setSuccessMessage(null);
      const parsedInput = JSON.parse(inputText);
      const loadedTargets = parseInputData(parsedInput);
      setTargets(loadedTargets);
      setSuccessMessage('JSON loaded and parsed successfully!');
    } catch (e) {
      setError(`Failed to parse JSON: ${(e as Error).message}`);
      setTargets([]);
    }
  };

  const generateOutputData = useCallback((): Record<string, string> => {
    const output: Record<string, string> = {};
    targets.forEach((target, targetIndex) => {
      output[`controlStyles[${targetIndex}].target`] = target.targetName;
      target.styles.forEach((style, styleIndex) => {
        output[`controlStyles[${targetIndex}].styles[${styleIndex}]`] = style.value;
      });
    });
    return output;
  }, [targets]);

  const handleGenerateJson = useCallback(async () => {
    try {
        const outputData = generateOutputData();
        const jsonString = JSON.stringify(outputData, null, 2);
        setOutputText(jsonString);
        await navigator.clipboard.writeText(jsonString);
        setSuccessMessage('JSON generated and copied to clipboard!');
        setError(null);
    } catch (e) {
        setError(`Failed to generate JSON or copy to clipboard: ${(e as Error).message}`);
        setSuccessMessage(null);
    }
  }, [generateOutputData]);


  // Target handlers
  const addTarget = () => {
    setTargets(prev => [...prev, { id: newId(), targetName: 'New Target', styles: [] }]);
  };

  const updateTargetName = (id: string, name: string) => {
    setTargets(prev => prev.map(t => t.id === id ? { ...t, targetName: name } : t));
  };

  const deleteTarget = (id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id));
  };

  const duplicateTarget = (id: string) => {
    setTargets(prev => {
      const targetIndex = prev.findIndex(t => t.id === id);
      if (targetIndex === -1) return prev;
      const originalTarget = prev[targetIndex];
      const newTarget: Target = {
        ...originalTarget,
        id: newId(),
        styles: originalTarget.styles.map(s => ({ ...s, id: newId() })),
      };
      const newTargets = [...prev];
      newTargets.splice(targetIndex + 1, 0, newTarget);
      return newTargets;
    });
  };

  // Style handlers
  const addStyle = (targetId: string) => {
    setTargets(prev => prev.map(t => 
      t.id === targetId ? { ...t, styles: [...t.styles, { id: newId(), value: 'NewStyle=Value' }] } : t
    ));
  };

  const updateStyleValue = (targetId: string, styleId: string, value: string) => {
    setTargets(prev => prev.map(t => 
      t.id === targetId ? { ...t, styles: t.styles.map(s => s.id === styleId ? { ...s, value } : s) } : t
    ));
  };

  const deleteStyle = (targetId: string, styleId: string) => {
    setTargets(prev => prev.map(t => 
      t.id === targetId ? { ...t, styles: t.styles.filter(s => s.id !== styleId) } : t
    ));
  };

  const duplicateStyle = (targetId: string, styleId: string) => {
    setTargets(prev => prev.map(t => {
      if (t.id !== targetId) return t;
      const styleIndex = t.styles.findIndex(s => s.id === styleId);
      if (styleIndex === -1) return t;
      const originalStyle = t.styles[styleIndex];
      const newStyle: Style = { ...originalStyle, id: newId() };
      const newStyles = [...t.styles];
      newStyles.splice(styleIndex + 1, 0, newStyle);
      return { ...t, styles: newStyles };
    }));
  };


  // Drag and Drop Handlers
  const onDragStart = (e: React.DragEvent, type: 'target' | 'style', id: string, parentId?: string) => {
    draggedItem.current = { type, id, parentId };
    e.dataTransfer.setData('text/plain', id); // Necessary for Firefox
    e.currentTarget.classList.add('dragging');
  };

  const onDragOver = (e: React.DragEvent, type: 'target' | 'style', id: string, parentId?: string) => {
    e.preventDefault(); // Allow drop
    dragOverItem.current = { type, id, parentId };

    if (!draggedItem.current) return;

    // Determine if dropping before or after the dragOverItem
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const before = e.clientY < midpoint;

    if (type === 'target') {
      setDropIndicator({ targetId: id, before });
    } else if (type === 'style' && parentId) {
      setDropIndicator({ styleParentId: parentId, styleId: id, before });
    }
  };
  
  const onDragLeave = (e: React.DragEvent) => {
    // Only clear indicator if leaving the actual potential drop zone, not just moving over children
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDropIndicator(null);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem.current || !dragOverItem.current) return;

    const { type: draggedType, id: draggedId, parentId: draggedParentId } = draggedItem.current;
    const { type: dropType, id: dropId, parentId: dropParentId } = dragOverItem.current;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2; // For targets
    const styleMidpoint = e.clientY - rect.top < rect.height / 2; // For styles, clientY relative to element

    const insertBefore = (draggedType === 'style' ? styleMidpoint : e.clientY < midpoint);

    if (draggedType === 'target' && dropType === 'target' && draggedId !== dropId) {
      setTargets(prevTargets => {
        const newTargets = [...prevTargets];
        const draggedIdx = newTargets.findIndex(t => t.id === draggedId);
        if (draggedIdx === -1) return prevTargets;

        const [itemToMove] = newTargets.splice(draggedIdx, 1);
        let dropIdx = newTargets.findIndex(t => t.id === dropId);
        
        if (insertBefore) {
            newTargets.splice(dropIdx, 0, itemToMove);
        } else {
            newTargets.splice(dropIdx + 1, 0, itemToMove);
        }
        return newTargets;
      });
    } else if (draggedType === 'style' && dropType === 'style' && draggedParentId === dropParentId && draggedId !== dropId) {
      setTargets(prevTargets => prevTargets.map(target => {
        if (target.id !== draggedParentId) return target;

        const newStyles = [...target.styles];
        const draggedIdx = newStyles.findIndex(s => s.id === draggedId);
        if (draggedIdx === -1) return target;
        
        const [itemToMove] = newStyles.splice(draggedIdx, 1);
        let dropIdx = newStyles.findIndex(s => s.id === dropId);

        if (insertBefore) {
            newStyles.splice(dropIdx, 0, itemToMove);
        } else {
            newStyles.splice(dropIdx + 1, 0, itemToMove);
        }
        return { ...target, styles: newStyles };
      }));
    }
    
    cleanUpDragState();
  };

  const onDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('dragging');
    cleanUpDragState();
  };
  
  const cleanUpDragState = () => {
    draggedItem.current = null;
    dragOverItem.current = null;
    setDropIndicator(null);
  };


  return (
    <>
      <h1>JSON Style Organizer</h1>

      <section aria-labelledby="input-heading">
        <h2 id="input-heading">Input JSON</h2>
        <div className="input-group">
          <label htmlFor="json-input" className="sr-only">Paste your JSON here:</label>
          <textarea
            id="json-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Paste your flat JSON structure here. E.g., {"controlStyles[0].target":"...", "controlStyles[0].styles[0]":"..."}'
            aria-label="Input JSON"
          />
        </div>
        <button onClick={handleLoadJson}>Load and Parse JSON</button>
        {error && <p className="error-message" role="alert">{error}</p>}
        {successMessage && !error && <p className="success-message" role="alert">{successMessage}</p>}
      </section>

      <section aria-labelledby="editor-heading">
        <h2 id="editor-heading">Style Editor</h2>
        <button onClick={addTarget}>Add New Target</button>
        <div className="targets-list" role="list">
          {targets.map((target, targetIndex) => (
            <React.Fragment key={target.id}>
              {dropIndicator && 'targetId' in dropIndicator && dropIndicator.targetId === target.id && dropIndicator.before && (
                <div className="drop-indicator" aria-hidden="true"></div>
              )}
              <div
                className="target-item"
                draggable
                onDragStart={(e) => onDragStart(e, 'target', target.id)}
                onDragOver={(e) => onDragOver(e, 'target', target.id)}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                role="listitem"
                aria-labelledby={`target-name-${target.id}`}
              >
                <div className="target-header">
                  <span className="drag-handle" aria-hidden="true">☰</span>
                  <label htmlFor={`target-name-${target.id}`} className="sr-only">Target Name</label>
                  <input
                    id={`target-name-${target.id}`}
                    type="text"
                    value={target.targetName}
                    onChange={(e) => updateTargetName(target.id, e.target.value)}
                    placeholder="Target Name"
                    aria-label="Target Name"
                  />
                  <div className="target-actions">
                    <button onClick={() => addStyle(target.id)} className="small">Add Style</button>
                    <button onClick={() => duplicateTarget(target.id)} className="small secondary">Duplicate Target</button>
                    <button onClick={() => deleteTarget(target.id)} className="small danger">Delete Target</button>
                  </div>
                </div>
                <div className="style-list" role="list">
                  {target.styles.map((style, styleIndex) => (
                    <React.Fragment key={style.id}>
                      {dropIndicator && 'styleId' in dropIndicator && dropIndicator.styleParentId === target.id && dropIndicator.styleId === style.id && dropIndicator.before && (
                        <div className="drop-indicator" aria-hidden="true"></div>
                      )}
                      <div
                        className="style-item"
                        draggable
                        onDragStart={(e) => onDragStart(e, 'style', style.id, target.id)}
                        onDragOver={(e) => onDragOver(e, 'style', style.id, target.id)}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onDragEnd={onDragEnd}
                        role="listitem"
                        aria-labelledby={`style-value-${style.id}`}
                      >
                        <span className="drag-handle" aria-hidden="true">☰</span>
                         <label htmlFor={`style-value-${style.id}`} className="sr-only">Style Value</label>
                        <input
                          id={`style-value-${style.id}`}
                          type="text"
                          value={style.value}
                          onChange={(e) => updateStyleValue(target.id, style.id, e.target.value)}
                          placeholder="Style Value"
                          aria-label="Style Value"
                        />
                        <div className="style-actions">
                            <button onClick={() => duplicateStyle(target.id, style.id)} className="small secondary">Duplicate</button>
                            <button onClick={() => deleteStyle(target.id, style.id)} className="small danger">Delete</button>
                        </div>
                      </div>
                       {dropIndicator && 'styleId' in dropIndicator && dropIndicator.styleParentId === target.id && dropIndicator.styleId === style.id && !dropIndicator.before && (
                        <div className="drop-indicator" aria-hidden="true"></div>
                      )}
                    </React.Fragment>
                  ))}
                   {target.styles.length === 0 && (
                    dropIndicator && 'styleParentId' in dropIndicator && dropIndicator.styleParentId === target.id && (
                        <div className="drop-indicator" aria-hidden="true" style={{marginLeft: '20px'}}></div> /* Placeholder for empty list */
                    )
                  )}
                </div>
              </div>
              {dropIndicator && 'targetId' in dropIndicator && dropIndicator.targetId === target.id && !dropIndicator.before && (
                <div className="drop-indicator" aria-hidden="true"></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      <section aria-labelledby="output-heading">
        <h2 id="output-heading">Generated JSON</h2>
        <button onClick={handleGenerateJson}>Generate and Copy JSON</button>
        <div className="input-group">
          <label htmlFor="json-output" className="sr-only">Generated JSON output:</label>
          <textarea
            id="json-output"
            value={outputText}
            readOnly
            placeholder="Generated JSON will appear here..."
            aria-label="Generated JSON Output"
          />
        </div>
      </section>
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
