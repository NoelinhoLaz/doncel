import { useState, useCallback } from 'react';

export interface ImportN43State {
  loading: boolean;
  error: string | null;
  resultado: any | null;
}

export interface UseImportN43 {
  state: ImportN43State;
  importar: (file: File, cuentaBancariaId: string) => Promise<void>;
  reset: () => void;
  aceptarMatch: (movimientoBancoId: string) => Promise<boolean>;
  rechazarMatch: (movimientoBancoId: string) => Promise<boolean>;
}

export function useImportN43(): UseImportN43 {
  const [state, setState] = useState<ImportN43State>({
    loading: false,
    error: null,
    resultado: null,
  });

  const importar = useCallback(
    async (file: File, cuentaBancariaId: string) => {
      setState({ loading: true, error: null, resultado: null });

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('cuenta_bancaria_id', cuentaBancariaId);

        const response = await fetch('/api/contabilidad/importar-n43', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'Error al importar fichero N43.'
          );
        }

        setState({ loading: false, error: null, resultado: data });
      } catch (err) {
        const error =
          err instanceof Error ? err.message : 'Error desconocido';
        setState({ loading: false, error, resultado: null });
      }
    },
    []
  );

  const aceptarMatch = useCallback(
    async (movimiento_banco_id: string): Promise<boolean> => {
      try {
        // Obtener el match desde el resultado actual
        const match = state.resultado?.matches?.find(
          (m: any) => m.movimiento_id === movimiento_banco_id
        );

        if (!match) {
          throw new Error('Propuesta de match no encontrada.');
        }

        const response = await fetch(
          '/api/contabilidad/conciliar-movimiento',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              movimiento_banco_id: match.movimiento_id,
              pagador_id: match.pagador_id,
              expediente_id: match.expediente_id,
              conciliacion_tipo: 'automatica',
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al conciliar movimiento.');
        }

        // Remover el match del estado para que desaparezca de la lista
        setState((prev) => {
          if (!prev.resultado) return prev;
          return {
            ...prev,
            resultado: {
              ...prev.resultado,
              matches_encontrados: Math.max(0, prev.resultado.matches_encontrados - 1),
              matches: prev.resultado.matches.filter(
                (m: any) => m.movimiento_id !== movimiento_banco_id
              ),
            },
          };
        });

        return true;
      } catch (err) {
        const error =
          err instanceof Error ? err.message : 'Error desconocido';
        setState((prev) => ({ ...prev, error }));
        return false;
      }
    },
    [state.resultado]
  );

  const rechazarMatch = useCallback(
    async (movimiento_banco_id: string): Promise<boolean> => {
      try {
        const response = await fetch(
          '/api/contabilidad/movimientos-banco/rechazar',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              movimiento_banco_id,
              estado: 'pendiente',
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al rechazar propuesta.');
        }

        // Remover del estado para que desaparezca de la lista
        setState((prev) => {
          if (!prev.resultado) return prev;
          return {
            ...prev,
            resultado: {
              ...prev.resultado,
              matches_encontrados: Math.max(0, prev.resultado.matches_encontrados - 1),
              matches: prev.resultado.matches.filter(
                (m: any) => m.movimiento_id !== movimiento_banco_id
              ),
            },
          };
        });

        return true;
      } catch (err) {
        const error =
          err instanceof Error ? err.message : 'Error desconocido';
        setState((prev) => ({ ...prev, error }));
        return false;
      }
    },
    [state.resultado]
  );

  const reset = useCallback(() => {
    setState({ loading: false, error: null, resultado: null });
  }, []);

  return {
    state,
    importar,
    reset,
    aceptarMatch,
    rechazarMatch,
  };
}
