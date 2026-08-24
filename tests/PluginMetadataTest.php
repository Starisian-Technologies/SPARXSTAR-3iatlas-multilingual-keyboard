<?php
declare(strict_types=1);

/**
 * Unit tests for immutable 3iAtlas plugin identity metadata.
 *
 * @package Starisian\Sparxstar\Atlas\Tests
 */

namespace Starisian\Sparxstar\Atlas\Tests;

use PHPUnit\Framework\TestCase;
use Starisian\Sparxstar\Atlas\PluginMetadata;

/**
 * Verifies that public plugin identity metadata remains valid and synchronized.
 */
final class PluginMetadataTest extends TestCase
{
    /**
     * Ensures the runtime version is a valid semantic version.
     */
    public function test_version_is_semantic(): void
    {
        self::assertMatchesRegularExpression(
            '/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/',
            PluginMetadata::VERSION
        );
    }

    /**
     * Ensures translation lookup uses the approved stable text domain.
     */
    public function test_text_domain_is_stable(): void
    {
        self::assertSame('sparxstar-3iatlas', PluginMetadata::TEXT_DOMAIN);
    }
}
