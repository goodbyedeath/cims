<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AiScore;
use App\Models\Channel;
use App\Models\Installment;
use App\Models\Order;

class AiScoringService
{
    public function scoreAllChannels(): void
    {
        Channel::chunk(100, function ($channels) {
            foreach ($channels as $channel) {
                $this->scoreChannel($channel);
            }
        });
    }

    public function scoreChannel(Channel $channel): AiScore
    {
        // Use the cached counters on the channel — don't double-count with a live query
        $successfulOrders  = (int) $channel->successful_order;
        $cancelationOrders = (int) $channel->cancelation_order;

        // Payment risk calculation
        $totalInstallments = Installment::whereHas('payment', function ($q) use ($channel) {
            $q->whereHas('order', fn ($oq) => $oq->where('channel_id', $channel->id));
        })->count();

        $lateInstallments = Installment::whereHas('payment', function ($q) use ($channel) {
            $q->whereHas('order', fn ($oq) => $oq->where('channel_id', $channel->id));
        })->where('status', 'late')->count();

        $totalActivity = $successfulOrders + $cancelationOrders + $totalInstallments;

        // No activity — keep neutral silver, score stays 0
        if ($totalActivity === 0) {
            $channel->update([
                'performance_score' => 0,
                'channel_grade'     => 'silver',
                'last_update'       => 'No activity yet',
                'last_update_at'    => now(),
            ]);

            return AiScore::updateOrCreate(
                ['channel_id' => $channel->id],
                [
                    'repeat_probability' => 0,
                    'risk_churn_score'   => 0,
                    'payment_risk_score' => 0,
                    'growth_score'       => 0,
                    'recommended_action' => 'No order history yet.|Focus on first order activation and channel onboarding.',
                    'generated_at'       => now(),
                ]
            );
        }

        $paymentRisk = $totalInstallments > 0
            ? round(($lateInstallments / $totalInstallments) * 100, 2)
            : 0;

        // Performance formula
        $performance = ($successfulOrders * 10)
            - ($cancelationOrders * 4)
            - ($paymentRisk * 0.5);

        $performanceScore = min(100, max(0, round($performance, 2)));

        $grade = match (true) {
            $performanceScore >= 90 => 'platinum',
            $performanceScore >= 75 => 'gold',
            $performanceScore >= 60 => 'silver',
            default                 => 'risk',
        };

        $repeatProbability = min(100, max(0, round($successfulOrders * 8, 2)));
        $riskChurnScore    = min(100, max(0, round(($cancelationOrders * 15) + ($paymentRisk * 0.5), 2)));
        $growthScore       = min(100, max(0, round(
            ($successfulOrders * 8) - ($cancelationOrders * 5), 2
        )));

        $recommendedAction = match (true) {
            $performanceScore >= 90          => 'Excellent partner — maintain relationship.|Offer premium partnership tier and volume-based discounts.',
            $performanceScore >= 75          => 'Strong performance — good growth potential.|Increase engagement frequency and introduce loyalty incentive programs.',
            $performanceScore >= 60          => 'Performance is stable but could improve.|Schedule regular follow-ups and review order patterns monthly.',
            $paymentRisk > 50                => 'High payment risk detected.|Review credit terms, tighten payment schedules, and escalate outstanding debt.',
            $cancelationOrders > $successfulOrders => 'Cancellation rate exceeds successful orders.|Investigate root causes and address service quality or product fit issues.',
            default                          => 'Channel at risk of churn.|Immediate attention required — consider re-engagement offers or account review.',
        };

        $channel->update([
            'performance_score' => $performanceScore,
            'channel_grade'     => $grade,
            'last_update'       => 'AI scoring completed',
            'last_update_at'    => now(),
        ]);

        return AiScore::updateOrCreate(
            ['channel_id' => $channel->id],
            [
                'repeat_probability' => $repeatProbability,
                'risk_churn_score'   => $riskChurnScore,
                'payment_risk_score' => $paymentRisk,
                'growth_score'       => $growthScore,
                'recommended_action' => $recommendedAction,
                'generated_at'       => now(),
            ]
        );
    }
}
