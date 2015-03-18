/**
 * Copyright 2013-2014 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone {
    /**
     * A collection of Fields.  This is designed for bulk reading, particularly to convert from one type of DataStore
     * to another.
     */
    interface DataStore {
        /** Returns the list of fields in their preferred order. */
        fields(): Field<any>[];
        /** Returns the field matching the key. */
        field(key: string): Field<any>;
        /**
         * Iterate over the rows of the DataStore.  Use in conjunction with Field.values() and UnaryField.value().
         */
        eachRow(rowAction: (rowToken: any) => void): any;
    }
    /**
     * A DataStore that can be queried.  Also the result of most queries.  Fields from filtered views can be used
     * interchangeably with fields from the original database.
     *
     * More technically:
     *
     * A RandomAccessStore's rows are identified by internal IDs which exist solely to allow for efficient querying.
     * These IDs are unique to a particular RandomAccessStore:  reconstructing the store in a slightly different way
     * may yield completely different IDs.
     *
     * The default implementation (ColumnStore) uses integers for IDs because it is built around IntSets;  future
     * implementations (e.g. unions of stores) may use something else for IDs.
     */
    interface RandomAccessStore extends DataStore {
        /** Returns a subset of this DataStore with the filter applied.  Applying the same filter twice has no effect. */
        filter(filter: Filter): RandomAccessStore;
        /** Creates an applies a ValueFilter. */
        filter(fieldId: string, value: any): RandomAccessStore;
        filter(field: Field<any>, value: any): RandomAccessStore;
        /** Returns all filters that have been applied, even if some are redundant. */
        filters(): Filter[];
        /**
         * Returns all filters that have been applied, with redundant ones merged.  This is optional, and meant for
         * user-friendly display, so it should only be applied if filters are redundant by definition.  For example,
         * an Or/Intersection filter may be removed when one of the intersected Filters is applied separately.
         */
        simplifiedFilters(): Filter[];
        /**
         *  Returns a RandomAccessStore that does not contain this filter.  If the filter is not applied, returns
         * itself.
         */
        removeFilter(filter: Filter): RandomAccessStore;
        /**
         * Filters on all values of a Field at once, returns a map from value strings to filtered RandomAccessStores.
         * Does not return any values with empty Stores.
         */
        partition(fieldId: string): {
            [value: string]: RandomAccessStore;
        };
        /** Returns partition(field.identifier). */
        partition(fieldDescription: FieldDescribing): {
            [value: string]: RandomAccessStore;
        };
        /** The number of elements in the DataStore. */
        size: number;
    }
    /** Shared properties of Field and FieldDescriptor. */
    interface FieldDescribing {
        /** The name used to access the field from its the DataStore. */
        identifier: string;
        /** The name users see for the field. */
        displayName: string;
        /** The data type of T;  the result of calling "typeof" on an item. */
        typeOfValue: string;
        /** The prototype for T, for identifying types when typeOfValue='object'.  This is experimental and might go away.*/
        typeConstructor: any;
        /**
         * If typeOfValue="number", describes the range and whether or not it is limited to integers.
         * Otherwise returns null.
         */
        range(): Range;
        /**
         * An estimate of the number of distinct values in the field (a.k.a. the attribute cardinality).  It
         * is intended to be used to determine how (or whether) another Store will store its values or what kind of
         * selection tool a UI will present.  Thus an exact value is of diminishing importance the more distinct values
         * there are. If the number of values is expected to be small (under 1000), it should give an exact count.  If
         * the number is expected to be large (over a tenth of the total number of records), it is reasonable to return
         * Number.POSITIVE_INFINITY.
         */
        distinctValueEstimate(): number;
    }
    /**
     * Follows the MapReduce pattern, although as written this is not intended to be thread safe.
     */
    interface Reducer<I, R> {
        /** Calls to onItem should generally be done inside an iterator, and done in order. */
        onItem(item: I): any;
        /** Returns the result and (often) resets for safe reuse. */
        onEnd(): R;
    }
    interface Iterator<I> {
        /** Returns true if the iterator has more items. */
        hasNext(): boolean;
        /** Returns the next item; subsequent calls return subsequent items.  Returns undefined if hasNext() is false. */
        next(): I;
    }
    /** Iterate over an ordered collection of items. */
    interface OrderedIterator<I> extends Iterator<I> {
        /**
         * Skip all items before "item."  The next call to next() will return the next element greater than or equal to
         * "item."
         *
         * Thus, for an iterator returning all integers from 1 to 10 where next() has never been
         * called, skipTo(0) and skipTo(1) do nothing, whereas skipTo(11) causes hasNext() to return false.
         */
        skipTo(item: I): any;
    }
    /**
     * An unchanging list of non-negative integers.  To work well under a variety of circumstances, we allow for many
     * implementations.  The interface is written as if it were from a low-level, non-JavaScript language in the hopes
     * that we can coerce JavaScript implementations to compile it into something extremely efficient.
     */
    interface IntSet {
        has(index: number): boolean;
        /**
         * The lowest value for which has() returns true, or -1 if size === 0.  This should be extremely fast.
         * The behavior when size === 0 may change in future versions.
         */
        min(): number;
        /**
         * The highest value for which has() returns true, or -1 if size === 0. This should be extremely fast.
         * The behavior when size === 0 may change in future versions.
         */
        max(): number;
        /** The number of values for which has() returns true. */
        size(): number;
        /** Iterate over all "true" elements in order. */
        each(action: (index: number) => void): any;
        /** Iterate over all "true" elements in order. */
        iterator(): OrderedIterator<number>;
        /** Returns an IntSet containing only the elements that are found in both IntSets. */
        union(bm: IntSet): IntSet;
        /** Returns an IntSet containing all the elements in either IntSet. */
        intersection(bm: IntSet): IntSet;
        /** Returns true if the iterators produce identical results. */
        equals(bm: IntSet): boolean;
    }
    /** An IntSet which stores its values as bits in 32-bit unsigned ints.   */
    interface PackedIntSet extends IntSet {
        /** Word which has the minimum true bit */
        minWord(): number;
        /** Word which has the maximum true bit */
        maxWord(): number;
        /** Iterate over all the packed words in order. */
        wordIterator(): OrderedIterator<number>;
        /** If true, the PackedIntSet methods are not just available, but preferred. */
        isPacked: boolean;
    }
    /** Most IntSet class objects should be IntSetBuilding to provide a factory method. */
    interface IntSetBuilding {
        /**
         * The returned Reducer is meant to be used once, to build exactly one IntSet.  A call to onItem()
         * sets a value, and calls should be done in order from lowest to highest.
         */
        builder(min?: number, max?: number): Reducer<number, IntSet>;
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
/**
 *  Contains public functions and tiny classes that are too small to merit their own file.
 */
declare module ozone {
    /**
     * Minimum and maximum values (inclusive), and whether every number is an integer.  For our purposes, an integer is
     * defined according to Mozilla's Number.isInteger polyfill and ECMA Harmony specification, namely:
     *
     * typeof nVal === "number" && isFinite(nVal) && nVal > -9007199254740992 && nVal < 9007199254740992 && Math.floor(nVal) === nVal;
     *
     * ( https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger )
     *
     * JSON.stringify(range) produces clean JSON that can be parsed back into an identical Range.
     */
    class Range {
        min: number;
        max: number;
        integerOnly: boolean;
        /**
         * Build from JSON;  in most cases you could just use the AJAX directly, but calling this provides
         * instanceof and toString().
         */
        static build(ajax: any): Range;
        constructor(min: number, max: number, integerOnly: boolean);
        toString(): string;
    }
    class AbstractReducer<I, R> implements Reducer<I, R> {
        constructor();
        onItem(item: I): void;
        /** Default implementation does nothing. */
        reset(): void;
        yieldResult(): R;
        onEnd(): R;
    }
    /**
     * Combine all descriptors, with later ones overwriting values provided by earlier ones.  All non-inherited
     * properties are copied over, plus all FieldDescribing (inherited or otherwise).
     * If range and distinctValueEstimate are functions, the result's function calls the original object's function.
     * If they are not functions, the result's function returns the value.
     */
    function mergeFieldDescriptors(...descriptors: FieldDescribing[]): FieldDescribing;
    function convert(item: any, descriptor: FieldDescribing): any;
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone {
    interface Filter {
        displayName: string;
        matches(store: RandomAccessStore, rowToken: any): boolean;
        /**
         * Returns true if the the other filter is equivalent AND is guaranteed to give the same result to
         * matches().  The display name may differ.
         *
         * Always returns false if the other filter has a different prototype.
         */
        equals(filter: Filter): boolean;
    }
    /**
     * Selects rows where a specific field has a specific value.  Note:  RowStore typically uses indexes to filter by
     * value, so this class is generally used only to trigger that code.
     */
    class ValueFilter implements Filter {
        fieldDescriptor: FieldDescribing;
        value: any;
        displayName: string;
        constructor(fieldDescriptor: FieldDescribing, value: any, displayName?: string);
        /**
         * Returns true if the row has the given value.  Note:  RowStore typically uses indexes to filter by
         * value, bypassing this method.
         */
        matches(store: RandomAccessStore, rowToken: any): boolean;
        equals(f: Filter): boolean;
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone {
    class StoreProxy implements DataStore {
        source: DataStore;
        constructor(source: DataStore);
        fields(): Field<any>[];
        field(key: string): Field<any>;
        eachRow(rowAction: (rowToken: any) => void): void;
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.columnStore {
    /**
     * This is the recommended way to generate a ColumnStore.
     *
     * @params  provides optional arguments:
     *
     *          fields:  maps from field identifiers in the source to field-specific params.  All FieldDescribing
     *                  properties and Builder parameters can be specified here.
     *
     *                   class: (within fields:) a Field class, such as UnIndexedField, or other object with a "builder" method.
     *
     *          buildAllFields: boolean, default is true.  If false, any fields not listed under 'Fields' are ignored.
     */
    function buildFromStore(source: DataStore, params?: any): ColumnStore;
}
/**
 * Copyright 2013-2014 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.columnStore {
    /**
     * A Field which is inefficient for filtering;  intended for columns where distinctValueEstimate is so large that
     * an IndexedField would use an unreasonable amount of memory. Stores the entire column in a single dense array.
     */
    class UnIndexedField<T> implements UnaryField<T>, RandomAccessField<T> {
        private array;
        private offset;
        private nullProxy;
        /**
         * Returns a reducer that can be run on a source DataStore to reproduce a sourceField.
         *
         * @param sourceField  the field which will be replicated
         * @param params       may override any FieldDescribing field, plus additional parameters:
         *                     nullValues   -- if provided, this is a list of values equivalent to null.
         *                     nullProxy    -- if provided, this is used instead of null for storing null values.  This
         *                                     may allow the JavaScript implementation to use an array of primitives.
         *                                     (Haven't yet checked to see if any JS implementations actually do this.)
         */
        static builder<T>(sourceField: UnaryField<T>, params?: any): Reducer<IndexedRowToken, UnIndexedField<T>>;
        constructor(descriptor: FieldDescribing, array: T[], offset?: number, nullProxy?: any);
        identifier: string;
        displayName: string;
        typeOfValue: string;
        typeConstructor: any;
        private valueEstimate;
        private rangeValue;
        value(rowToken: any): T;
        private isNull(item);
        values(rowToken: any): T[];
        range(): ozone.Range;
        distinctValueEstimate(): number;
        rowHasValue(rowToken: number, value: any): boolean;
        /** Returns the first rowToken;  this is for serialization and not intended for queries. */
        firstRowToken(): number;
        /** Returns a copy of the data array for serialization; not intended for queries. */
        dataArray(): any[];
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.columnStore {
    interface ColumnStoreInterface extends RandomAccessStore {
        /** Returns the row identifiers, which happen to be integers. */
        intSet(): IntSet;
    }
    /**
     * This is the native internal format for Ozone DataStores.  The ColumnStore is little more than a container for
     * Fields.  IndexedFields are generally more efficient than UnIndexedFields-- with the assumption that
     * Field.distinctValueEstimate() is usually low.
     *
     * <p>
     *     Conceptually the DataStore represents a dense array of rows, and each row is identified by its array index.
     *     In fact there is no such array;  the index exists to identify records across Fields.
     * </p>
     *
     * <p>
     *     Confusingly, "index" refers both to the map of values to row identifiers (i.e. a database index) and an
     *     individual row identifier, since conceptually (but not literally) the DataStore is a dense array of rows.
     * </p>
     */
    class ColumnStore implements ColumnStoreInterface {
        size: number;
        private fieldArray;
        /**
         * ECMAScript doesn't require associative arrays to retain the order of their keys, although most
         * implementations do.  (Rhino doesn't.)  So a separate fieldArray isn't completely redundant.
         */
        private fieldMap;
        constructor(size: number, fieldArray: RandomAccessField<any>[]);
        intSet(): IntSet;
        fields(): RandomAccessField<any>[];
        field(key: string): RandomAccessField<any>;
        filter(fieldNameOrFilter: any, value?: any): RandomAccessStore;
        filters(): Filter[];
        simplifiedFilters(): Filter[];
        removeFilter(filter: Filter): RandomAccessStore;
        partition(fieldAny: any): any;
        eachRow(rowAction: Function): void;
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.columnStore {
    function createFilter(store: ColumnStoreInterface, fieldNameOrFilter: any, value?: any): Filter;
    function filterColumnStore(source: ColumnStore, oldStore: ColumnStoreInterface, ...filtersToAdd: Filter[]): ColumnStoreInterface;
    function partitionColumnStore(store: ColumnStoreInterface, field: RandomAccessField<any>): {
        [value: string]: RandomAccessStore;
    };
    class FilteredColumnStore extends StoreProxy implements ColumnStoreInterface {
        source: ColumnStore;
        private filterArray;
        private filterBits;
        size: number;
        constructor(source: ColumnStore, filterArray: Filter[], filterBits: IntSet);
        intSet(): IntSet;
        eachRow(rowAction: (rowToken: any) => void): void;
        filter(fieldNameOrFilter: any, value?: any): RandomAccessStore;
        filters(): Filter[];
        simplifiedFilters(): Filter[];
        removeFilter(filter: Filter): RandomAccessStore;
        partition(fieldAny: any): any;
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.columnStore {
    interface IndexedRowToken {
        index: number;
        rowToken: any;
    }
    /**
     * A Field which stores values in an index, and each value is mapped to a list of row identifiers.  This is similar
     * to an SQL index on a column, except that SQL databases store both a row and (optionally) an index, whereas this
     * Field only stores the index-- the row itself is nothing more than an identifying row number.
     *
     * <p><b>Although values need not be strings, they are identified internally by their toString method.</b></p>
     *
     * It is legal for values to have empty intSets;  for example, a Month
     * field might contain all the months of the year in order, even if only a few have any values, to guarantee that
     * the UI looks right.
     */
    class IndexedField<T> implements RandomAccessField<T> {
        private valueList;
        private valueMap;
        /**
         * Returns a reducer that can be run on a source DataStore to reproduce a sourceField.
         *
         * @param sourceField  the field which will be replicated
         * @param params       additional parameters:
         *                     values       -- if provided, this is the list of values used and any values not in this
         *                                     list are ignored.  This also defines the order of values.
         *                     intSetSource -- if provided, a IntSetBuilding to override the default.  The default may
         *                                     change, and may be browser specific or determined based on the
         *                                     characteristics of sourceField.
         */
        static builder<T>(sourceField: Field<T>, params?: any): Reducer<IndexedRowToken, IndexedField<T>>;
        identifier: string;
        displayName: string;
        typeOfValue: string;
        typeConstructor: any;
        private rangeVal;
        constructor(descriptor: FieldDescribing, valueList: T[], valueMap: {
            (valueId: string): IntSet;
        });
        allValues(): T[];
        values(rowToken: any): T[];
        range(): Range;
        /** Equivalent to allValues().length. */
        distinctValueEstimate(): number;
        rowHasValue(index: number, value: any): boolean;
        /** Return the intSet matching value.toString(), or an empty intSet if the value is not found. */
        intSetForValue(value: any): IntSet;
    }
}
/**
 * Copyright 2014 by Vocal Laboratories, Inc. All rights reserved.
 */
/**
 * Bitwise operations on 32-bit numbers.  These match the asm.js standard for "int":  32-bit, unknown sign,
 * intended for bitwise use only.  In practice, JavaScript bitwise operators convert numbers to 32-bit two's-complement,
 * so that's what we use here.  We might actually use asm.js at some point, but hand coding it is a pain (see
 * https://github.com/zbjornson/human-asmjs).
 *
 * See:  http://asmjs.org/spec/latest/
 */
declare module ozone.intSet.bits {
    function singleBitMask(bitPos: number): number;
    /** Return a number with the bit at num%32 set to true. */
    function setBit(num: number, word: number): number;
    /** Return a number with the bit at num%32 set to false. */
    function unsetBit(num: number, word: number): number;
    /** Return true if the bit num%32 is set*/
    function hasBit(num: number, word: number): boolean;
    /** Returns the number of 1's set within the first 32-bits of this number. */
    function countBits(word: number): number;
    /** Returns the position of the minimum true bit in the lowest 32 bits of word, or -1 if all are false. */
    function minBit(word: number): number;
    /** Returns the position of the maximum true bit in the lowest 32 bits of word, or -1 if all are false. */
    function maxBit(word: number): number;
    /** Convert a string of 1's and 0's to a 32-bit number, throws an error if the string is too long. */
    function base2ToBits(str: string): number;
    /** Returns the 32-bit int 'bit' is in */
    function inWord(bit: number): number;
    /** Returns the offset into a 32-bit int that 'bit' is in */
    function offset(bit: number): number;
}
/**
 * Copyright 2013-2014 by Vocal Laboratories, Inc.  Distributed under the Apache License 2.0.
 */
declare module ozone.intSet {
    var empty: RangeIntSet;
    /**
     * A textbook binary search which returns the index where the item is found,
     * or two's complement of its insert location if it is not found.
     * Based on sample code from Oliver Caldwell at
     * http://oli.me.uk/2013/06/08/searching-javascript-arrays-with-a-binary-search/
     *
     * but note that that implementation is buggy.
     */
    function search(searchElement: any, array: any[], minIndex: number, maxIndex: number): number;
    /**
     * Return the default IntSet builder.  If min and max are provided, a builder optimized for that size may be returned.
     */
    function builder(min?: number, max?: number): Reducer<number, IntSet>;
    function mostEfficientIntSet(input: IntSet): IntSet;
    /** Return a IntSet containing all the numbers provided by the iterators. */
    function unionOfIterators(...iterators: Iterator<number>[]): IntSet;
    /** Return a IntSet containing all the numbers provided by the ordered iterators. This is more efficient
     * than unionOfIterators.  Returns the type of IntSet most appropriate for the size of the data.
     * */
    function unionOfOrderedIterators(...iterators: OrderedIterator<number>[]): IntSet;
    function unionOfIntSets(...intSets: IntSet[]): IntSet;
    /** Return a IntSet containing only the numbers provided by all of the iterators. */
    function intersectionOfOrderedIterators(...iterators: OrderedIterator<number>[]): IntSet;
    function intersectionOfOrderedIteratorsWithBuilder(builder: Reducer<number, IntSet>, iterators: OrderedIterator<number>[]): IntSet;
    function intersectionOfIntSets(...intSets: IntSet[]): IntSet;
    function equalIntSets(set1: IntSet, set2: IntSet): boolean;
    function packedBitwiseCompare(set1: PackedIntSet, set2: PackedIntSet, bitwiseCompare: (word1: number, word2: number) => number, hasNextCompare: (next1: boolean, next2: boolean) => boolean, minPicker: (min1: number, min2: number) => number): IntSet;
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.intSet {
    /**
     * The most trivial of general-purpose IntSet implementations;  a sorted array of indexes.  This can work well for
     * sparse data.
     * We don't use a boolean[], because while in practice it should iterate in construction order or index
     * order, we don't want to rely on JS runtime implementation details.
     */
    class ArrayIndexIntSet implements IntSet {
        private indexes;
        /** Matches the API of other IntSet builders. */
        static builder(min?: number, max?: number): Reducer<number, IntSet>;
        static fromArray(elements: number[]): ArrayIndexIntSet;
        size(): number;
        /** Always use builder() to construct. */
        constructor(indexes: number[]);
        toArray(): number[];
        has(index: number): boolean;
        min(): number;
        max(): number;
        each(action: (index: number) => void): void;
        iterator(): OrderedIterator<number>;
        equals(set: IntSet): boolean;
        union(set: IntSet): IntSet;
        intersection(set: IntSet): IntSet;
    }
    /** Iterator over dense arrays;  does not work with sparse arrays. */
    class OrderedArrayIterator<T> implements OrderedIterator<T> {
        private array;
        constructor(array: T[]);
        private nextIndex;
        hasNext(): boolean;
        next(): T;
        skipTo(item: T): void;
    }
}
/**
 * Copyright 2014 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.intSet {
    /**
     * Stores indexes in an Array of numbers, treating them as 32-bit unsigned integers.
     */
    class BitmapArrayIntSet implements PackedIntSet {
        private words;
        private wordOffset;
        private theSize;
        /***** Note: should we be ignoring min and max like this?  ******/
        static builder(min?: number, max?: number): Reducer<number, IntSet>;
        isPacked: boolean;
        private minValue;
        private maxValue;
        /**
         * Constructs a BitmapArrayIntSet.
         * @param words         The bitmap (not including the offset bits) as a number array
         * @param wordOffset    The number of 32-bit words which are all zeroes which proceed the given array.
         * @param theSize       The number of ones in the array (0 if 'words' is empty)
         */
        constructor(words: number[], wordOffset: number, theSize: number);
        size(): number;
        has(theBit: number): boolean;
        /**
         * The lowest value for which has() returns true, or -1 if size === 0.  This should be
         * extremely fast.
         * The behavior when size === 0 may change in future versions.
         */
        min(): number;
        /**
         * The highest value for which has() returns true, or -1 if size === 0.  This should be
         * extremely fast.
         * The behavior when size === 0 may change in future versions.
         */
        max(): number;
        /** Iterate over all "true" elements in order. */
        each(action: (index: number) => void): void;
        /** Iterate over all "true" elements in order. */
        iterator(): OrderedIterator<number>;
        /** Iterate over all the packed words in order. */
        wordIterator(): OrderedWordWithOffsetIterator;
        /** Returns an IntSet containing all the elements in either IntSet. */
        union(set: IntSet): IntSet;
        /** Returns an IntSet containing only the elements that are found in both IntSets. */
        intersection(set: IntSet): IntSet;
        /** Returns true if the iterators produce identical results. */
        equals(set: IntSet): boolean;
        minWord(): number;
        /** Equals Math.floor(min()/32). */
        maxWord(): number;
    }
    /**
     * Iterates over all the set bits in order.  This class does not support an index offset.
     */
    class OrderedBitmapArrayIterator implements OrderedIterator<number> {
        private words;
        private maxBit;
        constructor(words: number[], maxBit: number);
        private nextBit;
        hasNext(): boolean;
        /**
         * Returns the index of the next set bit.
         *
         * @returns {number}
         */
        next(): number;
        skipTo(item: number): void;
    }
    /**
     * Iterates over all the set bits in order.  This class does support an index offset.
     */
    class OrderedBitmapArrayWithOffsetIterator extends OrderedBitmapArrayIterator {
        private bitOffset;
        constructor(words: number[], maxBit: number, wordOffset: number);
        next(): number;
        skipTo(item: number): void;
    }
    class OrderedWordWithOffsetIterator implements OrderedIterator<number> {
        private words;
        private wordOffset;
        private nextWord;
        constructor(words: number[], wordOffset: number);
        hasNext(): boolean;
        next(): number;
        skipTo(item: number): void;
    }
}
/**
 * Copyright 2013-2014 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.intSet {
    /**
     * A trivial intSet which contains all values in a range.
     */
    class RangeIntSet implements IntSet {
        private minValue;
        private rangeSize;
        /** Return a RangeIntSet from minValue to maxValue inclusive. */
        static fromTo(minValue: number, maxValue: number): RangeIntSet;
        constructor(minValue: number, rangeSize: number);
        size(): number;
        has(index: number): boolean;
        min(): number;
        max(): number;
        each(action: (index: number) => void): void;
        iterator(): OrderedIterator<number>;
        equals(bm: IntSet): boolean;
        union(bm: IntSet): IntSet;
        intersection(bm: IntSet): IntSet;
        toString(): string;
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.rowStore {
    /** Build from a CSV file, with all resulting Fields treated as strings. */
    function buildFromCsv(csv: string): RowStore;
    /**
     * Build a RowStore.
     * @param fieldInfo  Descriptors for each Field, converted to FieldDescriptors via FieldDescriptor.build().
     * @param data       Data, either native (JsonField) format, or converted via a rowTransformer.
     * @param rowTransformer
     */
    function build(fieldInfo: {
        [key: string]: any;
    }, data: any[], rowTransformer?: Reducer<any, void>): RowStore;
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.rowStore {
    /** Converts CSV into simple JavaScript objects for use by RowStore.  The first row must provide column names. */
    class CsvReader implements Reducer<any, void> {
        delimiter: string;
        quote: string;
        ignoreFirstRow: boolean;
        columnNames: string[];
        private rowNumber;
        constructor(parameters?: any);
        private reset();
        /** Resets, including forgetting the column names. */
        onEnd(): void;
        onItem(row: any): any;
        private lineToArray(row);
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.rowStore {
    /**
     * A row-oriented DataStore that acts on an array of rows.  The interpretation of the rows is done entirely by
     * the Fields.  This is mainly intended for server-side (node.js) usage to convert data into more efficient formats.
     *
     * Although the current implementation stores rows in an array, this may someday be changed to be stream-based to
     * handle data more efficiently.  For this reason the public API only allows row access from start to end.
     */
    class RowStore implements DataStore {
        private fieldArray;
        private rowData;
        private rowTransformer;
        /**
         * ECMAScript doesn't require associative arrays to retain the order of their keys, although most
         * implementations do.  (Rhino doesn't.)  So a separate fieldArray isn't completely redundant.
         */
        private fieldMap;
        constructor(fieldArray: Field<any>[], rowData: any[], rowTransformer: Reducer<any, any>);
        fields(): Field<any>[];
        field(name: string): Field<any>;
        eachRow(rowAction: (rowToken: any) => void): void;
        /** Replace an existing field with this one.  If the old field isn't found, the new one is added at the end. */
        withField(newField: Field<any>): RowStore;
    }
    /** The default non-unary Field type for RowStores. */
    class JsonRowField<T> implements Field<T> {
        identifier: string;
        displayName: string;
        typeOfValue: string;
        typeConstructor: any;
        private rangeVal;
        private distinctValueEstimateVal;
        /** Private constructor:  please use factory methods. */
        constructor(identifier: string, displayName: string, typeOfValue: string, typeConstructor?: any, rangeVal?: Range, distinctValueEstimateVal?: number);
        range(): Range;
        distinctValueEstimate(): number;
        canHold(otherField: Field<T>): boolean;
        values(rowToken: any): T[];
    }
    class UnaryJsonRowField<T> implements UnaryField<T> {
        identifier: string;
        displayName: string;
        typeOfValue: string;
        typeConstructor: any;
        private rangeVal;
        private distinctValueEstimateVal;
        constructor(identifier: string, displayName: string, typeOfValue: string, typeConstructor?: any, rangeVal?: Range, distinctValueEstimateVal?: number);
        range(): Range;
        distinctValueEstimate(): number;
        canHold(otherField: Field<T>): boolean;
        values(rowToken: any): T[];
        value(rowToken: any): T;
    }
    class RangeCalculator extends AbstractReducer<any, Range> {
        field: Field<number>;
        private min;
        private max;
        private integerOnly;
        constructor(field: Field<number>);
        reset(): void;
        onItem(rowToken: any): void;
        yieldResult(): Range;
    }
    class ValueFrequencyCalculator implements Reducer<any, {
        [key: string]: number;
    }> {
        field: Field<any>;
        private map;
        constructor(field: Field<any>);
        onItem(rowToken: any): void;
        onEnd(): {
            [key: string]: number;
        };
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone.serialization {
    /** Mirrors DataStore.  Really should be called DataStoreData, but that would be silly. */
    interface StoreData {
        size: number;
        fields: FieldMetaData[];
    }
    /**
     * Mirrors FieldDescribing.  Type may currently be "indexed" or "unindexed."
     * Note that distinctValueEstimate may not be infinite since JSON doesn't allow infinity,
     * but for unindexed Fields it can be a gross overestimate of the exact values.
     */
    interface FieldMetaData {
        type: string;
        identifier: string;
        displayName: string;
        typeOfValue: string;
        distinctValueEstimate: number;
    }
    interface NumericalFieldMetaData extends FieldMetaData {
        range: RangeData;
    }
    /**  Required when typeOfValue==='object';  this is experimental and might go away.  */
    interface TypeConstructorFieldMetaData extends FieldMetaData {
        typeConstructorName: string;
    }
    interface RangeData {
        min: number;
        max: number;
        integerOnly: boolean;
    }
    interface IndexedFieldData extends FieldMetaData {
        values: ValueIndexData[];
    }
    interface ValueIndexData {
        value: any;
        data: IntSetMetaData;
    }
    interface UnIndexedFieldData extends FieldMetaData {
        offset: number;
        dataArray: any[];
    }
    interface IntSetMetaData {
        /**
         * Determines the sub-interface.  Subtypes are specified with a slash, hints are appended with a semicolon.
         *
         * The special type "empty" has no sub-interface.
         */
        type: string;
    }
    /** Type = "range". */
    interface IntSetRangeData extends IntSetMetaData {
        min: number;
        max: number;
    }
    /** Stores data as a sorted array.  Type = "array". */
    interface IntSetArrayData extends IntSetMetaData {
        /** The values, sorted from lowest to highest. */
        data: number[];
    }
}
/**
 * Copyright 2013-2014 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
/**
 * Convert ColumnStores, IntSets, etc. to JSON-compatible data objects.
 */
declare module ozone.serialization {
    /**
     * Convenience function for reading a string containing CSV.  This simply calls rowStore.buildFromCsv() and sends
     * the result to columnStore.buildFromStore().
     */
    function buildFromCsv(csvText: string, metaData?: any): columnStore.ColumnStore;
    /** Read Ozone's native JSON format. */
    function readStore(storeData: StoreData): columnStore.ColumnStore;
    function writeStore(store: columnStore.ColumnStore): StoreData;
    function readField(fieldData: FieldMetaData): RandomAccessField<any>;
    function writeField(f: RandomAccessField<any>): FieldMetaData;
    function readIntSet(jsonData: any): IntSet;
    function writeIntSet(toWrite: IntSet): IntSetMetaData;
    function parseType(typeString: String): ParsedType;
    class ParsedType {
        mainType: string;
        subTypes: string[];
        hints: string[];
        constructor(mainType: string, subTypes: string[], hints: string[]);
        next(): ParsedType;
    }
}
/**
 * Copyright 2013 by Vocal Laboratories, Inc. Distributed under the Apache License 2.0.
 */
declare module ozone {
    /**
     * An OLAP dimension.  Similar to a column in a database table, except that Fields may have multiple values per row.
     * Filtered stores should reuse fields from the unfiltered view.
     */
    interface Field<T> extends FieldDescribing {
        /**
         * Returns all values for this row.  Never returns null.  This is called within DataStore.eachRow(), and uses
         * the token provided by that function.
         *
         * Filtered stores may reuse fields from the unfiltered view, resulting in erroneous results if called outside
         * of DataStore.eachRow().
         */
        values(rowToken: any): T[];
    }
    /** All fields in a RandomAccessStore are RandomAccessFields. */
    interface RandomAccessField<T> extends Field<T> {
        /**
         * Used to implement filtering and access methods within a RandomAccessStore;  it should only be called using
         * tokens supplied by its store.
         *
         * Filtered stores may reuse fields from the unfiltered view, resulting in erroneous results if called outside
         * of DataStore.eachRow().
         */
        rowHasValue(rowToken: any, value: any): boolean;
    }
    /** A Field where values(row) returns at most one value. */
    interface UnaryField<T> extends Field<T> {
        /**
         * Returns the single value of values(rowToken), or null.  This is called within DataStore.eachRow(), and uses
         * the token provided by that function.
         */
        value(rowToken: any): T;
    }
    class FieldDescriptor implements FieldDescribing {
        identifier: string;
        typeOfValue: string;
        typeConstructor: any;
        multipleValuesPerRow: boolean;
        displayName: string;
        precomputedRange: Range;
        distinctValues: number;
        shouldCalculateDistinctValues: boolean;
        /**
         * Factory method for building from AJAX.  The AJAX must contain typeOfValue.  If an identifier is not provided
         * separately, that must also be provided. Additionally it may provide displayName, precomputedRange,
         * distinctValues, and multipleValuesPerRow.  If "unlimitedValues" is true,
         * shouldCalculateDistinctValues will be false and distinctValues will be Number.POSITIVE_INFINITY.
         *
         * The default for multipleValuesPerRow is false.
         */
        static build(ajax: any, identifier?: string): FieldDescriptor;
        constructor(identifier: string, typeOfValue: string, typeConstructor: any, multipleValuesPerRow: boolean, displayName: string, precomputedRange: Range, distinctValues: number, shouldCalculateDistinctValues: boolean);
        range(): Range;
        distinctValueEstimate(): number;
    }
}
