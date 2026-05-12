import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Alert } from '../types.js';

const LEVEL_EMOJI: Record<string, string> = {
  RED: '🔴',
  YELLOW: '🟡',
  GREEN: '🟢',
};

const LEVEL_LABEL: Record<string, string> = {
  RED: 'ALERTA RED — Promo + Inventário Confirmado',
  YELLOW: 'ALERTA YELLOW — Promo sem Inventário Confirmado',
  GREEN: 'OPORTUNIDADE GREEN — Inventário em Parceira',
};

export function formatAlert(alert: Alert): string {
  const emoji = LEVEL_EMOJI[alert.level] ?? '⚪';
  const label = LEVEL_LABEL[alert.level] ?? alert.level;

  const lines: string[] = [
    `${emoji} *${escapeMarkdown(label)}*`,
    `✈️ Rota: *${escapeMarkdown(alert.route)}*`,
  ];

  if (alert.promo !== null) {
    lines.push(`📰 Fonte: ${escapeMarkdown(alert.promo.title)}`);
    if (alert.promo.milesEstimate !== null) {
      lines.push(`💎 Milhas estimadas: *${formatMiles(alert.promo.milesEstimate)}/pax*`);
    }
    if (alert.promo.dateRange !== null) {
      const from = format(alert.promo.dateRange.from, 'MMM yyyy', { locale: ptBR });
      const to = format(alert.promo.dateRange.to, 'MMM yyyy', { locale: ptBR });
      lines.push(`📅 Período promo: ${escapeMarkdown(from)} → ${escapeMarkdown(to)}`);
    }
    lines.push(`🔗 [Ver promoção](${alert.promo.url})`);
  }

  if (alert.seat !== null) {
    const dateStr = format(alert.seat.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    lines.push(`🪑 Assento: *${alert.seat.seats}x J* via ${escapeMarkdown(alert.seat.program)}`);
    lines.push(`📆 Data: ${escapeMarkdown(dateStr)}`);
    lines.push(`💰 Milhas: *${formatMiles(alert.seat.miles)}/pax* \\+ taxas`);
    lines.push(`🔗 [Verificar no Seats\\.aero](${alert.seat.url})`);
  }

  lines.push(`\n_Detectado em: ${escapeMarkdown(format(alert.detectedAt, 'dd/MM/yyyy HH:mm'))}_`);

  return lines.join('\n');
}

function formatMiles(miles: number): string {
  return `${Math.round(miles / 1000)}k`;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, (c) => `\\${c}`);
}
