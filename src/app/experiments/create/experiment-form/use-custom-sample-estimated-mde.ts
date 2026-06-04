'use client';

import { getPowerCheckMutationKey, usePowerCheck } from '@/api/admin';
import { useEffect, useMemo, useState } from 'react';
import { ExperimentFormData } from './experiment-form-def';
import {
  buildCustomSampleEstimatedMdeRequest,
  serializeFrequentistPowerCheckFormInputs,
} from './experiment-form-helpers';

export function useCustomSampleEstimatedMde(
  data: ExperimentFormData,
  datasourceId: string,
  enabled: boolean,
): { estimatedMde: number | null | undefined; isLoading: boolean } {
  const { trigger: triggerEstimatedMde, isMutating: isLoading } = usePowerCheck(datasourceId, {
    swr: { swrKey: `${getPowerCheckMutationKey(datasourceId)[0]}/estimated-mde` },
  });

  const powerCheckFormKey = serializeFrequentistPowerCheckFormInputs(data);
  // `powerCheckFormKey` fingerprints form fields that affect the design spec (see serialize helper).
  const customSampleMdeRequest = useMemo(() => {
    if (!enabled) {
      return null;
    }
    const desiredN = data.desiredN;
    if (desiredN === undefined || !Number.isFinite(desiredN) || desiredN <= 0) {
      return null;
    }
    return buildCustomSampleEstimatedMdeRequest(data, desiredN);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `data` covered by powerCheckFormKey
  }, [enabled, powerCheckFormKey, data.desiredN]);

  const [estimatedMde, setEstimatedMde] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!customSampleMdeRequest) {
      setEstimatedMde(undefined);
      return;
    }

    const { design_spec, primaryMetricFieldName } = customSampleMdeRequest;
    let active = true;

    void (async () => {
      try {
        const response = await triggerEstimatedMde({ design_spec }, { throwOnError: false });
        if (!active || !response) {
          return;
        }
        const primary = response.analyses.find((a) => a.metric_spec.field_name === primaryMetricFieldName);
        setEstimatedMde(primary?.pct_change_with_desired_n ?? null);
      } catch {
        if (active) {
          setEstimatedMde(undefined);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [customSampleMdeRequest, triggerEstimatedMde]);

  return { estimatedMde, isLoading };
}
