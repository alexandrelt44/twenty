# PRD-972: tipo da etapa (aberta, ganha, perdida) no modelo do CRM

Proposta técnica. Sem código ainda. Base lida: `origin/colab-release` (b1971239650, Twenty 2.42.0).

## Problema

O ColabOS (PRD-971) precisa saber, para cada etapa do funil, se ela é aberta, ganha ou perdida. Hoje o Twenty não tem esse conceito. `opportunity.stage` é um campo SELECT com cinco opções (NEW, SCREENING, MEETING, PROPOSAL, CUSTOMER) e nenhuma delas diz se encerra o negócio. Não existe etapa "perdida" no padrão.

## Onde mora no modelo

- Opções do SELECT: `FieldMetadataEntity.options`, tipo `FieldMetadataComplexOption` (`id`, `value`, `label`, `position`, `color`) em `twenty-shared/src/types/FieldMetadataOptions.ts`.
- Configuração do campo: `FieldMetadataEntity.settings`, coluna JSONB, exposta na API de metadados como `GraphQLJSON` (`field-metadata.dto.ts:143`). `settings` já está na lista de propriedades editáveis, tanto para campos custom quanto standard (`flat-field-metadata-editable-properties.constant.ts`).
- O tipo `FieldMetadataSettingsMapping` (`twenty-shared/src/types/FieldMetadataSettings.ts`) não tem entrada para SELECT. Hoje `settings` de um SELECT é `null`, e nenhum validador olha esse JSON.

## Proposta

Guardar no `settings` do campo SELECT:

```json
{ "stageKinds": { "<option.id>": "OPEN" | "WON" | "LOST" } }
```

Regras:

- Chave é o `id` (uuid) da opção. É estável quando o label muda, e as opções padrão têm ids fixos entre workspaces.
- Opção sem entrada vale `OPEN`. Etapas novas nascem abertas sem ninguém fazer nada.
- O formato é genérico para SELECT, mas o v1 só liga a tela em `opportunity.stage`. O nome `stageKinds` fica como o Gerente ColabTools sugeriu.
- Pode haver várias etapas WON e várias LOST.

Alternativa descartada: colocar `kind` em cada opção. É mais coeso (não deixa chave órfã), mas mexe no tipo de opção, no saneamento de opções e no editor de opções da tela, que são áreas muito usadas e mudam entre versões do upstream.

## Mudanças

1. `twenty-shared`: tipo `FieldMetadataSelectSettings` (`stageKinds?: Record<string, 'OPEN' | 'WON' | 'LOST'>`) e entrada `[FieldMetadataType.SELECT]` no `FieldMetadataSettingsMapping`. Exige `npx nx build twenty-shared`.
2. `twenty-server`: validador novo `validate-select-flat-field-metadata.util.ts`, chamado de onde os outros validadores por tipo são chamados. Rejeita valor fora de OPEN/WON/LOST e chave que não seja id de uma opção existente do campo. Só `opportunity.stage` no v1 (decisão de 23/11): o validador aceita o formato em qualquer SELECT, mas a tela só mostra o seletor nesse campo.
3. Testes: unitário do validador e de integração do `updateOneField` com `settings`.
4. Tela (v1): seletor de tipo por etapa, descrito abaixo.

## Tela

Onde: `SettingsDataModelFieldSelectFormOptionRow.tsx`, a linha de cada opção em Configurações > Modelo de dados > Oportunidades > Stage. Cada linha ganha um seletor com Aberta, Ganha e Perdida (padrão Aberta), no mesmo estilo do seletor de cor que já existe na linha. Aparece só quando o campo é `opportunity.stage`; nos demais SELECT a linha fica como hoje.

Estado: o valor vive em `settings.stageKinds` do formulário (`SettingsDataModelFieldSelectForm.tsx`), por id da opção. Isso exige:
- `settingsDataModelFieldSelectFormSchema` ganhar `settings` opcional com `stageKinds`;
- o seletor atualizar `settings` com o objeto inteiro, porque o servidor substitui `settings` por completo (ver spike);
- ao remover uma opção na tela, a chave dela sair do `stageKinds` no mesmo `onChange`;
- `handleSave` já envia só os campos sujos, então `settings` vai junto de `options` quando mudar.

Texto com Lingui. Ícones de `twenty-ui/icon`. Teste de interface: trocar o tipo de uma etapa e conferir o `settings` enviado na mutation.

O campo `stage` é standard. Confirmar no spike da tela que a página de edição de campo standard deixa mexer nas opções (o `readonly` da página depende do contexto do workspace); se travar, o seletor herda a mesma regra.

## Migração

- Nenhuma migração de schema. `settings` já é JSONB, e a mudança não toca arquivo de entity, então não há instance command (`database:migrate:generate` não se aplica).
- Dados: nenhum comando de upgrade. Os workspaces têm etapas customizadas, então o mapeamento é configuração por workspace, feita pelo ColabOS ou à mão pela API. Sem entrada, tudo é OPEN e nada quebra.
- Não editar `compute-opportunity-standard-flat-field-metadata.util.ts`: é arquivo do upstream e a definição padrão não teria como cobrir etapas customizadas.

## Impacto em upgrade do fork

Superfície pequena: um tipo novo em `twenty-shared`, uma entrada no mapping e um arquivo novo de validador com uma linha de chamada. O conflito esperado é só no mapping e no ponto onde os validadores são chamados. Ao subir de 2.42 para 2.56.1, reler esses dois pontos antes do merge.

## Spike (23/11): resultados

- A sincronização da aplicação standard (`synchronizeTwentyStandardApplicationOrThrow`) só roda na criação do workspace (`workspace-manager.service.ts`) e no dev seeder. Em operação normal não regrava o `settings` do `stage`. Mas ela compara `settings` e não há lista de propriedades "do workspace" para campo (`workspace-owned-properties-by-metadata-name.constant.ts` só cobre pageLayout, skill e view): se um comando de upgrade futuro chamar a sync de novo, o `stageKinds` volta ao padrão. Mitigação: reler o ponto a cada upgrade, ou, se um dia precisar, incluir `settings` de fieldMetadata nessa lista (mudança pequena num arquivo do upstream).
- `updateOneField` faz merge por propriedade (`mergeUpdateInExistingRecord`), não por chave interna: `settings` enviado substitui o `settings` inteiro. Quem escreve (tela, ColabOS, MCP) precisa mandar o objeto completo.
- O upstream (`upstream/main`, 23/11) não tem `stageKinds`, `optionKinds` nem entrada de settings para SELECT. Sem equivalente a aproveitar, e risco de divergência futura é do nosso lado.

## Riscos restantes

- Chaves órfãs: se uma opção é removida pela API, a chave fica no JSON. Proposta: ignorar na leitura, rejeitar só na escrita. A tela já limpa a chave ao remover.
- O front e o back têm dois mapas de `settings` por tipo; ao subir para 2.56.1, reler o mapping e o schema de formulário antes do merge.

## Decisões do Alexandre (23/11)

1. Chave: id interno da opção.
2. Tela no v1, além da API: seletor de tipo por etapa nas configurações do campo.
3. Só `opportunity.stage` no v1.

## Esforço

Servidor e shared com testes: cerca de 1 dia. Tela: mais 1 a 2 dias. Nada vai para produção sem build de imagem e janela combinados.
