<?php
declare(strict_types=1);

/**
 * Immutable identity metadata for the 3iAtlas WordPress plugin.
 *
 * @package Starisian\Sparxstar\Atlas
 */

namespace Starisian\Sparxstar\Atlas;

/**
 * Supplies immutable plugin identity values to loaders and generated asset metadata.
 */
final class PluginMetadata
{
    /** Current package version used to version cacheable plugin assets. */
    public const VERSION = '0.1.0';

    /** Stable WordPress text domain used for all translated strings. */
    public const TEXT_DOMAIN = 'sparxstar-3iatlas';
}
