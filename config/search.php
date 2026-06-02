<?php

return [

    /*
     * Score weights for hybrid ranking.
     * bm25  = MySQL FULLTEXT relevance (weighted title vs body)
     * rank  = position decay (1st result > 2nd > ...)
     * boost = PHP-side title/prefix match bonus
     */
    'weights' => [
        'bm25'  => 0.55,
        'rank'  => 0.20,
        'boost' => 0.25,
    ],

    // Results per page on /search
    'per_page' => 15,

    // Max results fetched from each entity before merging
    'max_per_entity' => 50,

    // Title-field boost multiplier when term appears in title/name field
    'title_boost' => [
        'prefix'    => 2.0,   // query is a prefix of the title
        'contains'  => 1.4,   // query is a substring of the title
    ],

];
