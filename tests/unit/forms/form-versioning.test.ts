/**
 * Test suite for Form Versioning Service
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { FormVersioningService, VersionChangeType, FormVersionDiff } from '../../../backend/src/services/form_versioning';
import { FormSchema } from '../../../backend/src/models/forms';

// Mock database session
const mockDbSession = {
  execute: vi.fn(),
  add: vi.fn(),
  commit: vi.fn(),
  refresh: vi.fn(),
  rollback: vi.fn(),
  delete: vi.fn(),
} as any;

describe('FormVersioningService', () => {
  let versioningService: FormVersioningService;
  
  beforeEach(() => {
    versioningService = new FormVersioningService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Version Calculation', () => {
    it('should increment major version for breaking changes', () => {
      const currentVersion = '1.2.3';
      const newVersion = versioningService._increment_version(currentVersion, VersionChangeType.MAJOR);
      expect(newVersion).toBe('2.0.0');
    });

    it('should increment minor version for new features', () => {
      const currentVersion = '1.2.3';
      const newVersion = versioningService._increment_version(currentVersion, VersionChangeType.MINOR);
      expect(newVersion).toBe('1.3.0');
    });

    it('should increment patch version for bug fixes', () => {
      const currentVersion = '1.2.3';
      const newVersion = versioningService._increment_version(currentVersion, VersionChangeType.PATCH);
      expect(newVersion).toBe('1.2.4');
    });

    it('should handle invalid version strings gracefully', () => {
      const invalidVersion = 'invalid';
      const newVersion = versioningService._increment_version(invalidVersion, VersionChangeType.MINOR);
      expect(newVersion).toBe('1.0.0');
    });
  });

  describe('Field Difference Calculation', () => {
    it('should detect added fields', () => {
      const oldFields = [
        { id: 'field1', type: 'text', label: 'Field 1', required: false }
      ];
      
      const newFields = [
        { id: 'field1', type: 'text', label: 'Field 1', required: false },
        { id: 'field2', type: 'email', label: 'Field 2', required: true }
      ];

      const diff = versioningService._calculate_diff(oldFields, newFields);
      
      expect(diff.added_fields).toHaveLength(1);
      expect(diff.added_fields[0].id).toBe('field2');
      expect(diff.removed_fields).toHaveLength(0);
      expect(diff.modified_fields).toHaveLength(0);
      expect(diff.change_type).toBe(VersionChangeType.MINOR);
    });

    it('should detect removed fields', () => {
      const oldFields = [
        { id: 'field1', type: 'text', label: 'Field 1', required: false },
        { id: 'field2', type: 'email', label: 'Field 2', required: true }
      ];
      
      const newFields = [
        { id: 'field1', type: 'text', label: 'Field 1', required: false }
      ];

      const diff = versioningService._calculate_diff(oldFields, newFields);
      
      expect(diff.added_fields).toHaveLength(0);
      expect(diff.removed_fields).toHaveLength(1);
      expect(diff.removed_fields[0].id).toBe('field2');
      expect(diff.modified_fields).toHaveLength(0);
      expect(diff.change_type).toBe(VersionChangeType.MAJOR);
    });

    it('should detect modified fields', () => {
      const oldFields = [
        { id: 'field1', type: 'text', label: 'Field 1', required: false }
      ];
      
      const newFields = [
        { id: 'field1', type: 'text', label: 'Field 1 Updated', required: true }
      ];

      const diff = versioningService._calculate_diff(oldFields, newFields);
      
      expect(diff.added_fields).toHaveLength(0);
      expect(diff.removed_fields).toHaveLength(0);
      expect(diff.modified_fields).toHaveLength(1);
      expect(diff.modified_fields[0].id).toBe('field1');
      expect(diff.change_type).toBe(VersionChangeType.MINOR);
    });

    it('should detect type changes as major', () => {
      const oldFields = [
        { id: 'field1', type: 'text', label: 'Field 1', required: false }
      ];
      
      const newFields = [
        { id: 'field1', type: 'number', label: 'Field 1', required: false }
      ];

      const diff = versioningService._calculate_diff(oldFields, newFields);
      
      expect(diff.change_type).toBe(VersionChangeType.MAJOR);
      expect(diff.modified_fields).toHaveLength(1);
    });
  });

  describe('Migration Plan Creation', () => {
    it('should create migration plan for backward compatible changes', async () => {
      const fromSchema = {
        id: 'schema1',
        version: '1.0.0',
        fields: [
          { id: 'field1', type: 'text', label: 'Field 1', required: false }
        ]
      } as FormSchema;

      const toSchema = {
        id: 'schema2',
        version: '1.1.0',
        fields: [
          { id: 'field1', type: 'text', label: 'Field 1', required: false },
          { id: 'field2', type: 'text', label: 'Field 2', required: false }
        ]
      } as FormSchema;

      const plan = await versioningService.create_migration_plan(fromSchema, toSchema);

      expect(plan.from_version).toBe('1.0.0');
      expect(plan.to_version).toBe('1.1.0');
      expect(plan.backward_compatible).toBe(true);
      expect(plan.data_migration_required).toBe(false);
      expect(plan.warnings).toHaveLength(0);
    });

    it('should identify data migration requirements', async () => {
      const fromSchema = {
        id: 'schema1',
        version: '1.0.0',
        fields: [
          { id: 'field1', type: 'text', label: 'Field 1', required: false },
          { id: 'field2', type: 'text', label: 'Field 2', required: false }
        ]
      } as FormSchema;

      const toSchema = {
        id: 'schema2',
        version: '2.0.0',
        fields: [
          { id: 'field1', type: 'text', label: 'Field 1', required: false },
          { id: 'field3', type: 'email', label: 'Field 3', required: true }
        ]
      } as FormSchema;

      const plan = await versioningService.create_migration_plan(fromSchema, toSchema);

      expect(plan.data_migration_required).toBe(true);
      expect(plan.backward_compatible).toBe(false);
      expect(plan.warnings).toContain('This migration contains breaking changes');
      expect(plan.warnings).toContain('Data for 1 fields will be lost');
      expect(plan.warnings).toContain('New required fields may cause validation failures');
    });
  });

  describe('Response Data Migration', () => {
    it('should migrate response data correctly', () => {
      const responseData = {
        field1: 'value1',
        field2: 'value2',
        field3: 'value3'
      };

      const diff: FormVersionDiff = {
        change_type: VersionChangeType.MINOR,
        added_fields: [
          { id: 'field4', type: 'text', label: 'Field 4', required: false, defaultValue: 'default' }
        ],
        removed_fields: [
          { id: 'field3', type: 'text', label: 'Field 3', required: false }
        ],
        modified_fields: [],
        field_mappings: {
          field1: 'field1',
          field2: 'field2'
        }
      };

      const migratedData = versioningService._migrate_response_data(responseData, diff);

      expect(migratedData).toHaveProperty('field1', 'value1');
      expect(migratedData).toHaveProperty('field2', 'value2');
      expect(migratedData).not.toHaveProperty('field3'); // Removed field
      expect(migratedData).toHaveProperty('field4', 'default'); // Added with default
    });

    it('should handle field mappings', () => {
      const responseData = {
        old_field: 'value1'
      };

      const diff: FormVersionDiff = {
        change_type: VersionChangeType.PATCH,
        added_fields: [],
        removed_fields: [],
        modified_fields: [],
        field_mappings: {
          old_field: 'new_field'
        }
      };

      const migratedData = versioningService._migrate_response_data(responseData, diff);

      expect(migratedData).toHaveProperty('new_field', 'value1');
      expect(migratedData).not.toHaveProperty('old_field');
    });
  });

  describe('Field Comparison', () => {
    it('should detect no differences in identical fields', () => {
      const field1 = { id: 'field1', type: 'text', label: 'Field 1', required: false };
      const field2 = { id: 'field1', type: 'text', label: 'Field 1', required: false };

      const differ = versioningService._fields_differ(field1, field2);
      expect(differ).toBe(false);
    });

    it('should detect type differences', () => {
      const field1 = { id: 'field1', type: 'text', label: 'Field 1', required: false };
      const field2 = { id: 'field1', type: 'number', label: 'Field 1', required: false };

      const differ = versioningService._fields_differ(field1, field2);
      expect(differ).toBe(true);
    });

    it('should detect requirement differences', () => {
      const field1 = { id: 'field1', type: 'text', label: 'Field 1', required: false };
      const field2 = { id: 'field1', type: 'text', label: 'Field 1', required: true };

      const differ = versioningService._fields_differ(field1, field2);
      expect(differ).toBe(true);
    });

    it('should detect label differences', () => {
      const field1 = { id: 'field1', type: 'text', label: 'Field 1', required: false };
      const field2 = { id: 'field1', type: 'text', label: 'Field 1 Updated', required: false };

      const differ = versioningService._fields_differ(field1, field2);
      expect(differ).toBe(true);
    });

    it('should detect validation rule differences', () => {
      const field1 = { 
        id: 'field1', 
        type: 'text', 
        label: 'Field 1', 
        required: false,
        validation: { minLength: 5 }
      };
      const field2 = { 
        id: 'field1', 
        type: 'text', 
        label: 'Field 1', 
        required: false,
        validation: { minLength: 10 }
      };

      const differ = versioningService._fields_differ(field1, field2);
      expect(differ).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should create new version successfully', async () => {
      const mockSchema = {
        id: 'schema1',
        name: 'Test Form',
        version: '1.0.0',
        fields: [
          { id: 'field1', type: 'text', label: 'Field 1', required: false }
        ],
        validation_rules: {},
        metadata: {},
        created_by: 'user1'
      };

      mockDbSession.execute.mockResolvedValueOnce({
        scalar_one_or_none: () => mockSchema
      });

      const newFields = [
        { id: 'field1', type: 'text', label: 'Field 1', required: false },
        { id: 'field2', type: 'email', label: 'Field 2', required: true }
      ];

      const newSchema = await versioningService.create_new_version(
        mockDbSession,
        'schema1',
        newFields,
        'Added email field',
        VersionChangeType.MINOR
      );

      expect(mockDbSession.add).toHaveBeenCalled();
      expect(mockDbSession.commit).toHaveBeenCalled();
      expect(newSchema.version).toBe('1.1.0');
    });

    it('should handle missing schema gracefully', async () => {
      mockDbSession.execute.mockResolvedValueOnce({
        scalar_one_or_none: () => null
      });

      await expect(
        versioningService.create_new_version(
          mockDbSession,
          'nonexistent',
          [],
          'Test',
          VersionChangeType.MINOR
        )
      ).rejects.toThrow('Form schema not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during version creation', async () => {
      const mockSchema = {
        id: 'schema1',
        name: 'Test Form',
        version: '1.0.0',
        fields: [{ id: 'field1', type: 'text', label: 'Field 1', required: false }],
        validation_rules: {},
        metadata: {},
        created_by: 'user1'
      };

      mockDbSession.execute.mockResolvedValueOnce({
        scalar_one_or_none: () => mockSchema
      });

      mockDbSession.commit.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        versioningService.create_new_version(
          mockDbSession,
          'schema1',
          [],
          'Test',
          VersionChangeType.MINOR
        )
      ).rejects.toThrow();

      expect(mockDbSession.rollback).toHaveBeenCalled();
    });
  });
});

describe('FormVersionDiff', () => {
  it('should create valid diff object', () => {
    const diff = new FormVersionDiff({
      change_type: VersionChangeType.MINOR,
      added_fields: [{ id: 'field1', type: 'text', label: 'Field 1', required: false }],
      removed_fields: [],
      modified_fields: [],
      field_mappings: { field1: 'field1' }
    });

    expect(diff.change_type).toBe(VersionChangeType.MINOR);
    expect(diff.added_fields).toHaveLength(1);
    expect(diff.removed_fields).toHaveLength(0);
    expect(diff.modified_fields).toHaveLength(0);
  });
});