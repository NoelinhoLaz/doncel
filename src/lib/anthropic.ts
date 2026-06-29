import Anthropic from '@anthropic-ai/sdk'
import { obtenerApiKeyDesencriptada } from '@/actions/apikeys'

/**
 * Devuelve un cliente Anthropic inicializado con la API key almacenada
 * de forma encriptada en la tabla `agencias_api_keys` de la BD Admin.
 *
 * @param agenciaId - UUID de la agencia cuya key queremos usar.
 * @param nombreKey - Nombre con el que se guardó la key (por defecto "Anthropic Claude").
 */
export async function getAnthropicClient(
  agenciaId: string,
  nombreKey = 'Anthropic Claude'
): Promise<Anthropic> {
  const apiKey = await obtenerApiKeyDesencriptada(nombreKey, agenciaId)
    .catch(() => null) || process.env.ANTHROPIC_API_KEY!

  return new Anthropic({
    apiKey,
    defaultHeaders: {
      'anthropic-beta': 'pdfs-2024-09-25'
    }
  })
}

