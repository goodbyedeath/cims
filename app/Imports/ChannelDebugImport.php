<?php

declare(strict_types=1);

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToArray;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class ChannelDebugImport implements ToArray, WithHeadingRow
{
    public array $rows = [];

    public function array(array $rows): void
    {
        $this->rows = $rows;
    }
}
